import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { aiJobs, aiUsageEvents, users } from "@/db/schema";
import {
  cancelAiJob,
  softDeleteConversationAndCancelJobs,
} from "@/lib/ai/jobs/cancel";
import { enqueueAiJob } from "@/lib/ai/jobs/enqueue";
import { executeAiJob } from "@/lib/ai/jobs/execute";
import { runAiJobMaintenance } from "@/lib/ai/jobs/recover";
import { drainAiWorker } from "@/lib/ai/jobs/worker";
import { createAiConversation } from "@/lib/data/ai-conversations";
import { claimAiJobs, getAiJobById } from "@/lib/data/ai-jobs";
import { getAiDailyBudgetCounter } from "@/lib/data/ai-budget";
import { resetServerEnvCache } from "@/lib/env";

function newUser(name = "Cancel Test") {
  return {
    id: randomUUID(),
    name,
    email: `${randomUUID()}@example.test`,
  };
}

function setAiEnv() {
  process.env.AI_ENABLED = "true";
  process.env.AI_PROVIDER = "mock";
  process.env.AI_RATE_LIMIT_PER_MINUTE = "50";
  process.env.AI_DAILY_TOKEN_BUDGET = "100000";
  process.env.AI_DAILY_COST_BUDGET_USD = "1";
  process.env.AI_GLOBAL_DAILY_COST_BUDGET_USD = "20";
  process.env.AI_OPENAI_MAX_OUTPUT_TOKENS = "64";
  process.env.AI_PRICING_VERSION = "2026-11-17";
  resetServerEnvCache();
}

beforeEach(async () => {
  setAiEnv();
  await runAiJobMaintenance(getDb());
  await drainAiWorker(getDb(), { workerIdPrefix: "cancel-cleanup" });
});

afterEach(() => {
  delete process.env.AI_ENABLED;
  resetServerEnvCache();
});

async function enqueue(userId: string) {
  const db = getDb();
  const conv = await createAiConversation(db, userId, { title: "c" });
  const result = await enqueueAiJob(db, {
    userId,
    conversationId: conv.id,
    clientRequestId: randomUUID(),
    content: "キャンセルテスト",
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("enqueue failed");
  return { ...result, conv };
}

describe("cancelAiJob", () => {
  it("cancels queued jobs and releases reserved budget", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const { job } = await enqueue(user.id);

    const canceled = await cancelAiJob(db, user.id, job.id);
    expect(canceled.ok).toBe(true);
    if (!canceled.ok) return;
    expect(canceled.job.status).toBe("canceled");
    expect(canceled.alreadyTerminal).toBe(false);

    const [usage] = await db
      .select()
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.id, job.usageEventId!));
    expect(usage.status).toBe("error");
    expect(usage.errorCode).toBe("canceled");

    const budget = await getAiDailyBudgetCounter(db, "user", user.id);
    expect(Number(budget!.reservedUsd)).toBe(0);
  });

  it("sets cancel_requested on running jobs; worker cancels before provider", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const { job } = await enqueue(user.id);
    const [claimed] = await claimAiJobs(db, { workerId: "w-run" });
    expect(claimed.id).toBe(job.id);

    const req = await cancelAiJob(db, user.id, job.id);
    expect(req.ok).toBe(true);
    if (!req.ok) return;
    expect(req.job.status).toBe("running");
    expect(req.job.cancelRequestedAt).toBeTruthy();

    const exec = await executeAiJob(db, {
      job: claimed,
      workerId: "w-run",
    });
    expect(exec.ok).toBe(false);
    if (!exec.ok) expect(exec.reason).toBe("canceled");

    const fresh = await getAiJobById(db, job.id);
    expect(fresh?.status).toBe("canceled");
    expect(fresh?.providerOutcome).toBe("not_started");
  });

  it("is idempotent for completed and already-canceled jobs", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const { job } = await enqueue(user.id);
    await drainAiWorker(db, { workerIdPrefix: "done" });
    const done = await getAiJobById(db, job.id);
    expect(done?.status).toBe("succeeded");

    const again = await cancelAiJob(db, user.id, job.id);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.alreadyTerminal).toBe(true);
    expect(again.job.status).toBe("succeeded");

    const { job: j2 } = await enqueue(user.id);
    await cancelAiJob(db, user.id, j2.id);
    const twice = await cancelAiJob(db, user.id, j2.id);
    expect(twice.ok).toBe(true);
    if (!twice.ok) return;
    expect(twice.alreadyTerminal).toBe(true);
    expect(twice.job.status).toBe("canceled");
  });

  it("returns not_found for other users", async () => {
    const db = getDb();
    const a = newUser("A");
    const b = newUser("B");
    await db.insert(users).values([a, b]);
    const { job } = await enqueue(a.id);
    const cross = await cancelAiJob(db, b.id, job.id);
    expect(cross).toEqual({ ok: false, code: "not_found" });
  });

  it("soft-delete cancels queued and requests cancel on running; worker refuses new assistant", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const queued = await enqueue(user.id);
    const running = await enqueue(user.id);
    // Mimic claim for the specific running job (avoid shared-queue oldest-first).
    const now = new Date();
    const [runningClaim] = await db
      .update(aiJobs)
      .set({
        status: "running",
        lockedBy: "w-soft",
        leaseExpiresAt: new Date(now.getTime() + 60_000),
        fencingToken: 1,
        attempt: 1,
        executionPhase: "before_provider",
        startedAt: now,
      })
      .where(eq(aiJobs.id, running.job.id))
      .returning();
    expect(runningClaim.id).toBe(running.job.id);

    const conv = await softDeleteConversationAndCancelJobs(
      db,
      user.id,
      queued.conv.id,
    );
    expect(conv?.status).toBe("deleted");
    await softDeleteConversationAndCancelJobs(db, user.id, running.conv.id);

    const q = await getAiJobById(db, queued.job.id);
    expect(q?.status).toBe("canceled");

    const r = await getAiJobById(db, running.job.id);
    expect(r?.cancelRequestedAt).toBeTruthy();

    const exec = await executeAiJob(db, {
      job: runningClaim,
      workerId: "w-soft",
    });
    expect(exec.ok).toBe(false);
    if (!exec.ok) expect(exec.reason).toBe("canceled");
  });

  it("does not double-settle when cancel races after success", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const { job } = await enqueue(user.id);
    await drainAiWorker(db, { workerIdPrefix: "race" });
    const budgetBefore = await getAiDailyBudgetCounter(db, "user", user.id);
    await cancelAiJob(db, user.id, job.id);
    const budgetAfter = await getAiDailyBudgetCounter(db, "user", user.id);
    expect(budgetAfter!.spentUsd).toBe(budgetBefore!.spentUsd);
    expect(Number(budgetAfter!.reservedUsd)).toBe(0);
  });
});
