import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { aiUsageEvents, users } from "@/db/schema";
import { enqueueAiJob } from "@/lib/ai/jobs/enqueue";
import { executeAiJob, ProviderUncertainFailure } from "@/lib/ai/jobs/execute";
import {
  failExhaustedBeforeProviderJobs,
  reconcileUncertainBudgets,
  recoverExpiredAiJobLeases,
  runAiJobMaintenance,
} from "@/lib/ai/jobs/recover";
import { drainAiWorker } from "@/lib/ai/jobs/worker";
import { createAiConversation } from "@/lib/data/ai-conversations";
import {
  claimAiJobs,
  forceAiJobLeaseExpiry,
  getAiJobById,
  updateAiJobWithFence,
} from "@/lib/data/ai-jobs";
import { getAiDailyBudgetCounter } from "@/lib/data/ai-budget";
import { resetServerEnvCache } from "@/lib/env";
import type { AiProvider } from "@/lib/ai/types";

function newUser() {
  return {
    id: randomUUID(),
    name: "Recover",
    email: `${randomUUID()}@example.test`,
  };
}

function setAiEnv() {
  process.env.AI_ENABLED = "true";
  process.env.AI_PROVIDER = "mock";
  process.env.AI_RATE_LIMIT_PER_MINUTE = "50";
  process.env.AI_DAILY_TOKEN_BUDGET = "100000";
  process.env.AI_DAILY_COST_BUDGET_USD = "1";
  process.env.AI_DAILY_JOB_LIMIT = "100";
  process.env.AI_MAX_CONCURRENT_JOBS = "10";
  process.env.AI_GLOBAL_DAILY_COST_BUDGET_USD = "20";
  process.env.AI_UNCERTAIN_RECONCILE_AFTER_HOURS = "24";
  process.env.AI_OPENAI_MAX_OUTPUT_TOKENS = "64";
  process.env.AI_PRICING_VERSION = "2026-11-17";
  resetServerEnvCache();
}

beforeEach(async () => {
  setAiEnv();
  await runAiJobMaintenance(getDb());
  await drainAiWorker(getDb(), { workerIdPrefix: "rec-cleanup" });
});

afterEach(() => {
  delete process.env.AI_ENABLED;
  delete process.env.AI_UNCERTAIN_RECONCILE_AFTER_HOURS;
  resetServerEnvCache();
});

async function enqueue(userId: string) {
  const db = getDb();
  const conv = await createAiConversation(db, userId, { title: "r" });
  const result = await enqueueAiJob(db, {
    userId,
    conversationId: conv.id,
    clientRequestId: randomUUID(),
    content: "recover",
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("enqueue failed");
  return result.job;
}

describe("lease recovery + uncertain reconcile", () => {
  it("reclaims before_provider after lease expiry (auto-retry)", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const job = await enqueue(user.id);
    const [old] = await claimAiJobs(db, { workerId: "dead", leaseMs: 60_000 });
    expect(old.id).toBe(job.id);

    await forceAiJobLeaseExpiry(db, job.id, new Date(Date.now() - 1000));
    const recovered = await recoverExpiredAiJobLeases(db);
    expect(recovered.requeueEligible).toBeGreaterThanOrEqual(1);
    // Only assert our job was not marked uncertain (shared DB may have leftovers).
    const ours = await getAiJobById(db, job.id);
    expect(ours?.status).toBe("running");
    expect(ours?.executionPhase).toBe("before_provider");
    expect(ours?.providerOutcome).toBe("not_started");

    const [neu] = await claimAiJobs(db, { workerId: "alive" });
    expect(neu.id).toBe(job.id);
    expect(neu.fencingToken).toBeGreaterThan(old.fencingToken);

    const stale = await updateAiJobWithFence(
      db,
      {
        jobId: old.id,
        workerId: "dead",
        fencingToken: old.fencingToken,
      },
      { status: "succeeded", clearLock: true },
    );
    expect(stale).toEqual({ ok: false, reason: "stale_fence" });

    const ok = await executeAiJob(db, { job: neu, workerId: "alive" });
    expect(ok.ok).toBe(true);
  });

  it("marks calling_provider lease expiry as uncertain and never auto-retries", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const job = await enqueue(user.id);
    const [claimed] = await claimAiJobs(db, { workerId: "w1" });

    await updateAiJobWithFence(
      db,
      {
        jobId: claimed.id,
        workerId: "w1",
        fencingToken: claimed.fencingToken,
      },
      { executionPhase: "calling_provider" },
    );
    await forceAiJobLeaseExpiry(db, job.id, new Date(Date.now() - 1000));

    const a = await recoverExpiredAiJobLeases(db);
    const b = await recoverExpiredAiJobLeases(db);
    expect(a.markedUncertain).toBe(1);
    expect(b.markedUncertain).toBe(0);

    const fresh = await getAiJobById(db, job.id);
    expect(fresh?.status).toBe("failed");
    expect(fresh?.providerOutcome).toBe("uncertain");

    const claimedAgain = await claimAiJobs(db, {
      workerId: "retry",
      limit: 5,
    });
    expect(claimedAgain.find((j) => j.id === job.id)).toBeUndefined();

    // Reserved still held until reconcile
    const [usage] = await db
      .select()
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.id, job.usageEventId!));
    expect(usage.status).toBe("reserved");
  });

  it("does not re-call provider after calling_provider crash before settle (scenario E)", async () => {
    // Simulates: execute entered calling_provider → provider returned → worker
    // died before settle TX → lease expired → another worker claims/recovers.
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const job = await enqueue(user.id);
    const [claimed] = await claimAiJobs(db, {
      workerId: "dead-worker",
      leaseMs: 60_000,
    });

    // executeAiJob sets this BEFORE awaiting provider.complete.
    await updateAiJobWithFence(
      db,
      {
        jobId: claimed.id,
        workerId: "dead-worker",
        fencingToken: claimed.fencingToken,
      },
      { executionPhase: "calling_provider" },
    );
    // Provider already returned in memory but settle never committed:
    // usage remains reserved (no ok / invalid_output row yet).
    const [usageBefore] = await db
      .select()
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.id, job.usageEventId!));
    expect(usageBefore.status).toBe("reserved");

    await forceAiJobLeaseExpiry(db, job.id, new Date(Date.now() - 1_000));
    const recovered = await recoverExpiredAiJobLeases(db);
    expect(recovered.markedUncertain).toBeGreaterThanOrEqual(1);

    const afterRecover = await getAiJobById(db, job.id);
    expect(afterRecover?.status).toBe("failed");
    expect(afterRecover?.providerOutcome).toBe("uncertain");
    expect(afterRecover?.lockedBy).toBeNull();

    let providerCalls = 0;
    const spyProvider: AiProvider = {
      id: "mock",
      async complete() {
        providerCalls += 1;
        throw new Error("must not be called after calling_provider recover");
      },
    };

    const reclaimed = await claimAiJobs(db, {
      workerId: "other-worker",
      limit: 10,
    });
    expect(reclaimed.find((j) => j.id === job.id)).toBeUndefined();

    // Stale dead worker cannot settle or re-enter provider.
    const stale = await executeAiJob(db, {
      job: claimed,
      workerId: "dead-worker",
      provider: spyProvider,
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.reason).toBe("stale_fence");
    expect(providerCalls).toBe(0);

    // Worker drain path also must not pick this job up for a second call.
    await drainAiWorker(db, {
      workerIdPrefix: "scenario-e",
      provider: spyProvider,
    });
    expect(providerCalls).toBe(0);

    const [usageAfter] = await db
      .select()
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.id, job.usageEventId!));
    expect(usageAfter.status).toBe("reserved");
  });

  it("reconciles uncertain reserved budget after the window (concurrent-safe)", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const job = await enqueue(user.id);
    const [claimed] = await claimAiJobs(db, { workerId: "u1" });
    await executeAiJob(db, {
      job: claimed,
      workerId: "u1",
      provider: {
        id: "mock",
        async complete() {
          throw new ProviderUncertainFailure("timeout");
        },
      },
    });

    const finished = await getAiJobById(db, job.id);
    expect(finished?.providerOutcome).toBe("uncertain");

    // Force finished_at into the past for reconcile window.
    await db
      .update((await import("@/db/schema")).aiJobs)
      .set({ finishedAt: new Date(Date.now() - 48 * 3600_000) })
      .where(eq((await import("@/db/schema")).aiJobs.id, job.id));

    const [r1, r2] = await Promise.all([
      reconcileUncertainBudgets(db, { olderThanMs: 24 * 3600_000 }),
      reconcileUncertainBudgets(db, { olderThanMs: 24 * 3600_000 }),
    ]);
    expect(r1.reconciled + r2.reconciled).toBe(1);

    const [usage] = await db
      .select()
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.id, job.usageEventId!));
    expect(usage.status).toBe("error");
    expect(usage.errorCode).toBe("uncertain_reconciled");

    const budget = await getAiDailyBudgetCounter(db, "user", user.id);
    expect(Number(budget!.reservedUsd)).toBe(0);

    const again = await reconcileUncertainBudgets(db, {
      olderThanMs: 24 * 3600_000,
    });
    expect(again.reconciled).toBe(0);
  });

  it("fails exhausted before_provider attempts and releases budget", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const job = await enqueue(user.id);
    const [claimed] = await claimAiJobs(db, { workerId: "ex" });
    // Bump attempt to max without calling provider.
    await db
      .update((await import("@/db/schema")).aiJobs)
      .set({
        attempt: claimed.maxAttempts,
        executionPhase: "before_provider",
        providerOutcome: "not_started",
      })
      .where(eq((await import("@/db/schema")).aiJobs.id, job.id));
    await forceAiJobLeaseExpiry(db, job.id, new Date(Date.now() - 1000));

    const result = await failExhaustedBeforeProviderJobs(db);
    expect(result.failed).toBe(1);
    const fresh = await getAiJobById(db, job.id);
    expect(fresh?.status).toBe("failed");
    expect(fresh?.providerOutcome).toBe("failed");
    expect(fresh?.errorCode).toBe("max_attempts");

    const budget = await getAiDailyBudgetCounter(db, "user", user.id);
    expect(Number(budget!.reservedUsd)).toBe(0);
  });
});
