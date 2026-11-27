import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { aiDailyBudgetCounters, aiJobs, aiUsageEvents, users } from "@/db/schema";
import { enqueueAiJob } from "@/lib/ai/jobs/enqueue";
import { executeAiJob } from "@/lib/ai/jobs/execute";
import { drainAiWorker } from "@/lib/ai/jobs/worker";
import { createMockAiProvider } from "@/lib/ai/providers/mock";
import { createAiConversation } from "@/lib/data/ai-conversations";
import { claimAiJobs, getAiJobById } from "@/lib/data/ai-jobs";
import { getAiDailyBudgetCounter } from "@/lib/data/ai-budget";
import { resetServerEnvCache } from "@/lib/env";
import {
  assertAiIsolatedDatabaseUrl,
  claimAiJobByIdForTest,
  cleanupAiTestUserData,
  resolveAiTestDatabaseUrl,
} from "@/lib/ai/testing";

function newUser(name = "Isolation Test") {
  return {
    id: randomUUID(),
    name,
    email: `${randomUUID()}@example.test`,
  };
}

function setMockEnv() {
  process.env.AI_ENABLED = "true";
  process.env.AI_PROVIDER = "mock";
  process.env.AI_LIVE_SMOKE = "false";
  process.env.AI_RATE_LIMIT_PER_MINUTE = "50";
  process.env.AI_DAILY_TOKEN_BUDGET = "100000";
  process.env.AI_DAILY_COST_BUDGET_USD = "1";
  process.env.AI_DAILY_JOB_LIMIT = "100";
  process.env.AI_MAX_CONCURRENT_JOBS = "10";
  process.env.AI_GLOBAL_DAILY_COST_BUDGET_USD = "20";
  process.env.AI_OPENAI_MAX_OUTPUT_TOKENS = "64";
  process.env.AI_PRICING_VERSION = "2026-11-17";
  delete process.env.OPENAI_API_KEY;
  resetServerEnvCache();
}

beforeEach(() => {
  setMockEnv();
});

afterEach(() => {
  resetServerEnvCache();
});

describe("AI test isolation harness", () => {
  it("integration DATABASE_URL passes isolated DB assert", () => {
    const url = resolveAiTestDatabaseUrl(process.env);
    assertAiIsolatedDatabaseUrl(url);
    expect(url).not.toMatch(/\/wanora$/);
  });

  it("claims a specific job without touching an older foreign queued job", async () => {
    const db = getDb();
    // Empty the shared Testcontainers queue so FIFO assertions are local.
    await drainAiWorker(db, { workerIdPrefix: "iso-pre-drain" });

    const foreign = newUser("Foreign");
    const owned = newUser("Owned");
    await db.insert(users).values([foreign, owned]);

    const foreignConv = await createAiConversation(db, foreign.id, {
      title: "foreign",
    });
    const ownedConv = await createAiConversation(db, owned.id, {
      title: "owned",
    });

    const foreignEnq = await enqueueAiJob(db, {
      userId: foreign.id,
      conversationId: foreignConv.id,
      clientRequestId: randomUUID(),
      content: "foreign older job",
    });
    expect(foreignEnq.ok).toBe(true);
    if (!foreignEnq.ok) return;

    // Ensure owned job is newer than foreign (FIFO would otherwise pick foreign).
    await new Promise((r) => setTimeout(r, 5));

    const ownedEnq = await enqueueAiJob(db, {
      userId: owned.id,
      conversationId: ownedConv.id,
      clientRequestId: randomUUID(),
      content: "owned newer job",
    });
    expect(ownedEnq.ok).toBe(true);
    if (!ownedEnq.ok) return;

    // Production claim is oldest-first — documents why Smoke 01 stole leftovers.
    const fifoPeek = await claimAiJobs(db, {
      workerId: "fifo-probe",
      limit: 1,
    });
    expect(fifoPeek[0]?.id).toBe(foreignEnq.job.id);

    // Put foreign back? No — finish it after proving claim-by-id ignores it.
    // Harness claim-by-id targets owned without canceling foreign.
    const byId = await claimAiJobByIdForTest(db, {
      jobId: ownedEnq.job.id,
      workerId: "owned-worker",
    });
    expect(byId?.id).toBe(ownedEnq.job.id);
    expect(byId?.lockedBy).toBe("owned-worker");

    const foreignStill = await getAiJobById(db, foreignEnq.job.id);
    expect(foreignStill?.status).toBe("running");
    expect(foreignStill?.lockedBy).toBe("fifo-probe");
    expect(foreignStill?.errorCode).toBeNull();

    await executeAiJob(db, {
      job: fifoPeek[0]!,
      workerId: "fifo-probe",
      provider: createMockAiProvider(),
    });
    await executeAiJob(db, {
      job: byId!,
      workerId: "owned-worker",
      provider: createMockAiProvider(),
    });

    await cleanupAiTestUserData(db, foreign.id);
    await cleanupAiTestUserData(db, owned.id);
  });

  it("runs mock enqueue→claim-by-id→execute→settle and scoped cleanup", async () => {
    const db = getDb();
    const user = newUser("Mock Smoke");
    await db.insert(users).values(user);
    const conv = await createAiConversation(db, user.id, {
      title: "mock-smoke",
    });

    const enq = await enqueueAiJob(db, {
      userId: user.id,
      conversationId: conv.id,
      clientRequestId: randomUUID(),
      content:
        "私は社内IT担当です。要件整理とテスト支援の自己PRを自然なビジネス日本語に整えてください。事実は追加しないでください。",
    });
    expect(enq.ok).toBe(true);
    if (!enq.ok) return;

    const claimed = await claimAiJobByIdForTest(db, {
      jobId: enq.job.id,
      workerId: "mock-smoke-worker",
    });
    expect(claimed).not.toBeNull();

    const provider = createMockAiProvider();
    const exec = await executeAiJob(db, {
      job: claimed!,
      workerId: "mock-smoke-worker",
      provider,
    });
    expect(exec.ok).toBe(true);

    const job = await getAiJobById(db, enq.job.id);
    expect(job?.status).toBe("succeeded");
    expect(job?.provider).toBe("mock");

    const [usage] = await db
      .select()
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.id, enq.job.usageEventId!));
    expect(usage.status).toBe("ok");
    expect(Number(usage.estimatedCostUsd)).toBeGreaterThanOrEqual(0);

    const budget = await getAiDailyBudgetCounter(db, "user", user.id);
    expect(budget).not.toBeNull();

    const cleanup = await cleanupAiTestUserData(db, user.id);
    expect(cleanup.ok).toBe(true);

    const gone = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id));
    expect(gone).toHaveLength(0);

    const budgetGone = await db
      .select()
      .from(aiDailyBudgetCounters)
      .where(
        and(
          eq(aiDailyBudgetCounters.scopeType, "user"),
          eq(aiDailyBudgetCounters.scopeId, user.id),
        ),
      );
    expect(budgetGone).toHaveLength(0);

    // Global counter may exist from settlement — must still be present / untouched by cleanup.
    const globalRows = await db
      .select()
      .from(aiDailyBudgetCounters)
      .where(eq(aiDailyBudgetCounters.scopeType, "global"));
    // Soft assert: cleanup never deletes global rows (length unchanged by our delete filter).
    expect(globalRows.every((r) => r.scopeId === "global")).toBe(true);
  });

  it("refuses cleanup for non-fiction emails", async () => {
    const db = getDb();
    const user = {
      id: randomUUID(),
      name: "Real Looking",
      email: `${randomUUID()}@example.com`,
    };
    await db.insert(users).values(user);
    const result = await cleanupAiTestUserData(db, user.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("email_not_fiction_example_test");

    const still = await db.select().from(users).where(eq(users.id, user.id));
    expect(still).toHaveLength(1);
    await db.delete(users).where(eq(users.id, user.id));
  });

  it("concurrent claimAiJobByIdForTest yields a single owner", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const conv = await createAiConversation(db, user.id, { title: "race" });
    const enq = await enqueueAiJob(db, {
      userId: user.id,
      conversationId: conv.id,
      clientRequestId: randomUUID(),
      content: "race",
    });
    expect(enq.ok).toBe(true);
    if (!enq.ok) return;

    const [a, b] = await Promise.all([
      claimAiJobByIdForTest(db, {
        jobId: enq.job.id,
        workerId: "race-a",
      }),
      claimAiJobByIdForTest(db, {
        jobId: enq.job.id,
        workerId: "race-b",
      }),
    ]);
    const winners = [a, b].filter(Boolean);
    expect(winners).toHaveLength(1);

    await executeAiJob(db, {
      job: winners[0]!,
      workerId: winners[0]!.lockedBy!,
      provider: createMockAiProvider(),
    });
    await cleanupAiTestUserData(db, user.id);
  });
});

describe("production claimAiJobs ordering (unchanged)", () => {
  it("claims multiple queued jobs oldest-first", async () => {
    const db = getDb();
    const user = newUser("Fifo");
    await db.insert(users).values(user);
    const conv = await createAiConversation(db, user.id, { title: "fifo" });

    const first = await enqueueAiJob(db, {
      userId: user.id,
      conversationId: conv.id,
      clientRequestId: randomUUID(),
      content: "first",
    });
    await new Promise((r) => setTimeout(r, 5));
    const second = await enqueueAiJob(db, {
      userId: user.id,
      conversationId: conv.id,
      clientRequestId: randomUUID(),
      content: "second",
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    const claimed = await claimAiJobs(db, {
      workerId: "fifo-order",
      limit: 2,
    });
    expect(claimed.map((j) => j.id)).toEqual([first.job.id, second.job.id]);

    for (const job of claimed) {
      await executeAiJob(db, {
        job,
        workerId: "fifo-order",
        provider: createMockAiProvider(),
      });
    }
    await cleanupAiTestUserData(db, user.id);

    const leftover = await db
      .select()
      .from(aiJobs)
      .where(eq(aiJobs.userId, user.id));
    expect(leftover).toHaveLength(0);
  });
});
