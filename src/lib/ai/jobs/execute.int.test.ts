import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { aiMessages, aiUsageEvents, users } from "@/db/schema";
import { enqueueAiJob } from "@/lib/ai/jobs/enqueue";
import {
  executeAiJob,
  ProviderCleanFailure,
  ProviderUncertainFailure,
} from "@/lib/ai/jobs/execute";
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

function newUser(name = "Execute Test") {
  return {
    id: randomUUID(),
    name,
    email: `${randomUUID()}@example.test`,
  };
}

function setAiEnv(overrides: Record<string, string> = {}) {
  process.env.AI_ENABLED = "true";
  process.env.AI_PROVIDER = "mock";
  process.env.AI_RATE_LIMIT_PER_MINUTE = "50";
  process.env.AI_DAILY_TOKEN_BUDGET = "100000";
  process.env.AI_DAILY_COST_BUDGET_USD = "1";
  process.env.AI_GLOBAL_DAILY_COST_BUDGET_USD = "20";
  process.env.AI_OPENAI_MAX_OUTPUT_TOKENS = "64";
  process.env.AI_PRICING_VERSION = "2026-11-17";
  Object.assign(process.env, overrides);
  resetServerEnvCache();
}

beforeEach(async () => {
  setAiEnv();
  // Clear queued leftovers from earlier shared-DB suites (e.g. enqueue.int).
  await drainAiWorker(getDb(), { workerIdPrefix: "exec-cleanup" });
});

afterEach(() => {
  delete process.env.AI_ENABLED;
  delete process.env.AI_RATE_LIMIT_PER_MINUTE;
  delete process.env.AI_DAILY_TOKEN_BUDGET;
  delete process.env.AI_DAILY_COST_BUDGET_USD;
  delete process.env.AI_GLOBAL_DAILY_COST_BUDGET_USD;
  resetServerEnvCache();
});

async function enqueueOne(userId: string, content = "こんにちは") {
  const db = getDb();
  const conv = await createAiConversation(db, userId, { title: "exec" });
  const result = await enqueueAiJob(db, {
    userId,
    conversationId: conv.id,
    clientRequestId: randomUUID(),
    content,
    pageContext: { path: "/ja/my-career", area: "my_career" },
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("enqueue failed");
  return result;
}

describe("executeAiJob / worker", () => {
  it("persists assistant message and settles usage on success", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const enq = await enqueueOne(user.id, "職務経歴を要約");

    await drainAiWorker(db, { workerIdPrefix: "w-ok" });
    const job = await getAiJobById(db, enq.job.id);
    expect(job?.status).toBe("succeeded");
    expect(job?.resultMessageId).toBeTruthy();
    expect(job?.providerOutcome).toBe("succeeded");
    expect(job?.lockedBy).toBeNull();

    const [assistant] = await db
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.id, job!.resultMessageId!));
    expect(assistant.role).toBe("assistant");
    expect(assistant.content).toContain("【モック応答】");

    const [usage] = await db
      .select()
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.id, job!.usageEventId!));
    expect(usage.status).toBe("ok");

    const budget = await getAiDailyBudgetCounter(db, "user", user.id);
    expect(Number(budget!.reservedUsd)).toBe(0);
    expect(Number(budget!.spentUsd)).toBeGreaterThan(0);
  });

  it("stale fencing token cannot settle after reclaim", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const enq = await enqueueOne(user.id);

    const [old] = await claimAiJobs(db, {
      workerId: "w-old",
      leaseMs: 60_000,
    });
    expect(old.id).toBe(enq.job.id);

    await forceAiJobLeaseExpiry(db, old.id, new Date(Date.now() - 1_000));
    const [neu] = await claimAiJobs(db, { workerId: "w-new" });
    expect(neu.id).toBe(enq.job.id);
    expect(neu.fencingToken).toBeGreaterThan(old.fencingToken);

    const stale = await executeAiJob(db, {
      job: old,
      workerId: "w-old",
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.reason).toBe("stale_fence");

    const fresh = await executeAiJob(db, {
      job: neu,
      workerId: "w-new",
    });
    expect(fresh.ok).toBe(true);

    const job = await getAiJobById(db, enq.job.id);
    expect(job?.status).toBe("succeeded");
    expect(job?.lockedBy).toBeNull();
  });

  it("rejects duplicate settle after success (fenced)", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const enq = await enqueueOne(user.id);
    const [claimed] = await claimAiJobs(db, { workerId: "w1" });
    expect(claimed.id).toBe(enq.job.id);

    const first = await executeAiJob(db, {
      job: claimed,
      workerId: "w1",
    });
    expect(first.ok).toBe(true);

    const second = await updateAiJobWithFence(
      db,
      {
        jobId: claimed.id,
        workerId: "w1",
        fencingToken: claimed.fencingToken,
      },
      { status: "succeeded", clearLock: true },
    );
    expect(second).toEqual({ ok: false, reason: "stale_fence" });

    const [usage] = await db
      .select()
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.id, enq.job.usageEventId!));
    expect(usage.status).toBe("ok");
  });

  it("marks clean provider failure as failed and releases reserve", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const enq = await enqueueOne(user.id);
    const [claimed] = await claimAiJobs(db, { workerId: "w-fail" });
    expect(claimed.id).toBe(enq.job.id);

    const failing: AiProvider = {
      id: "mock",
      async complete() {
        throw new ProviderCleanFailure("mock boom", "mock_error");
      },
    };

    const result = await executeAiJob(db, {
      job: claimed,
      workerId: "w-fail",
      provider: failing,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("provider_failed");

    const job = await getAiJobById(db, enq.job.id);
    expect(job?.status).toBe("failed");
    expect(job?.providerOutcome).toBe("failed");
    expect(job?.errorCode).toBe("mock_error");

    const [usage] = await db
      .select()
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.id, enq.job.usageEventId!));
    expect(usage.status).toBe("error");

    const budget = await getAiDailyBudgetCounter(db, "user", user.id);
    expect(Number(budget!.reservedUsd)).toBe(0);
  });

  it("marks uncertain provider outcome without auto-retry reclaim", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const enq = await enqueueOne(user.id);
    const [claimed] = await claimAiJobs(db, { workerId: "w-unc" });
    expect(claimed.id).toBe(enq.job.id);

    const uncertain: AiProvider = {
      id: "mock",
      async complete() {
        throw new ProviderUncertainFailure("timeout");
      },
    };

    const result = await executeAiJob(db, {
      job: claimed,
      workerId: "w-unc",
      provider: uncertain,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("provider_uncertain");

    const job = await getAiJobById(db, enq.job.id);
    expect(job?.status).toBe("failed");
    expect(job?.providerOutcome).toBe("uncertain");

    await forceAiJobLeaseExpiry(
      db,
      enq.job.id,
      new Date(Date.now() - 1_000),
    );
    const reclaimed = await claimAiJobs(db, { workerId: "w-retry", limit: 5 });
    expect(reclaimed.find((j) => j.id === enq.job.id)).toBeUndefined();
  });

  it("aborts before calling_provider as canceled (safe release)", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const enq = await enqueueOne(user.id);
    const [claimed] = await claimAiJobs(db, { workerId: "w-abort-pre" });

    let completeCalls = 0;
    const provider: AiProvider = {
      id: "mock",
      async complete() {
        completeCalls += 1;
        return {
          text: "should not run",
          usage: { inputTokens: 1, outputTokens: 1 },
          provider: "mock",
          model: "mock-v1",
          latencyMs: 1,
        };
      },
    };

    const ac = new AbortController();
    ac.abort();
    const result = await executeAiJob(db, {
      job: claimed,
      workerId: "w-abort-pre",
      provider,
      signal: ac.signal,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("canceled");
    expect(completeCalls).toBe(0);

    const job = await getAiJobById(db, enq.job.id);
    expect(job?.status).toBe("canceled");
    expect(job?.executionPhase).toBe("before_provider");
    expect(job?.providerOutcome).toBe("not_started");
    expect(job?.errorCode).toBe("aborted_before_provider");

    const [usage] = await db
      .select()
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.id, enq.job.usageEventId!));
    // Reserved released as terminal error (same path as cancel release).
    expect(usage.status).toBe("error");
    expect(usage.errorCode).toBe("aborted_before_provider");
  });

  it("aborts during provider call as uncertain and never re-calls provider", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const enq = await enqueueOne(user.id);
    const [claimed] = await claimAiJobs(db, { workerId: "w-abort-mid" });

    let completeCalls = 0;
    let enteredComplete!: () => void;
    const entered = new Promise<void>((resolve) => {
      enteredComplete = resolve;
    });

    const provider: AiProvider = {
      id: "mock",
      async complete(req) {
        completeCalls += 1;
        expect(req.signal).toBeInstanceOf(AbortSignal);
        enteredComplete();
        await new Promise<never>((_resolve, reject) => {
          const onAbort = () => {
            const err = new Error("worker shutdown");
            err.name = "AbortError";
            reject(err);
          };
          if (req.signal?.aborted) {
            onAbort();
            return;
          }
          req.signal?.addEventListener("abort", onAbort, { once: true });
        });
        throw new Error("unreachable");
      },
    };

    const ac = new AbortController();
    const resultPromise = executeAiJob(db, {
      job: claimed,
      workerId: "w-abort-mid",
      provider,
      signal: ac.signal,
    });
    await entered;
    ac.abort();
    const result = await resultPromise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("provider_uncertain");
    expect(completeCalls).toBe(1);

    const job = await getAiJobById(db, enq.job.id);
    expect(job?.status).toBe("failed");
    expect(job?.providerOutcome).toBe("uncertain");

    await forceAiJobLeaseExpiry(
      db,
      enq.job.id,
      new Date(Date.now() - 1_000),
    );
    const reclaimed = await claimAiJobs(db, {
      workerId: "w-abort-retry",
      limit: 5,
    });
    expect(reclaimed.find((j) => j.id === enq.job.id)).toBeUndefined();
  });

  it("forwards worker stop AbortSignal through startAiWorker to provider", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const enq = await enqueueOne(user.id, "shutdown-signal");

    let sawSignal = false;
    let enteredComplete!: () => void;
    const entered = new Promise<void>((resolve) => {
      enteredComplete = resolve;
    });

    const { startAiWorker } = await import("@/lib/ai/jobs/worker");
    const provider: AiProvider = {
      id: "mock",
      async complete(req) {
        sawSignal = req.signal instanceof AbortSignal;
        enteredComplete();
        await new Promise<never>((_resolve, reject) => {
          const onAbort = () => {
            const err = new Error("aborted by worker stop");
            err.name = "AbortError";
            reject(err);
          };
          if (req.signal?.aborted) {
            onAbort();
            return;
          }
          req.signal?.addEventListener("abort", onAbort, { once: true });
        });
        throw new Error("unreachable");
      },
    };

    const handle = startAiWorker({
      db,
      workerId: "w-stop-signal",
      provider,
      leaseMs: 90_000,
      pollIntervalMs: 50,
      maxJobs: 1,
    });

    await entered;
    await handle.stop();
    await handle.done;

    expect(sawSignal).toBe(true);
    const job = await getAiJobById(db, enq.job.id);
    expect(job?.providerOutcome).toBe("uncertain");
  });

  it("concurrent workers claim distinct jobs via SKIP LOCKED", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const a = await enqueueOne(user.id, "job-a");
    const b = await enqueueOne(user.id, "job-b");

    const [c1, c2] = await Promise.all([
      claimAiJobs(db, { workerId: "wa", limit: 1 }),
      claimAiJobs(db, { workerId: "wb", limit: 1 }),
    ]);
    const ids = new Set([...c1, ...c2].map((j) => j.id));
    expect(ids.size).toBe(2);
    expect(ids.has(a.job.id)).toBe(true);
    expect(ids.has(b.job.id)).toBe(true);

    const results = await Promise.all([
      ...c1.map((job) => executeAiJob(db, { job, workerId: "wa" })),
      ...c2.map((job) => executeAiJob(db, { job, workerId: "wb" })),
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it("settles empty text with usage as invalid_output (billed, not uncertain)", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const enq = await enqueueOne(user.id);
    const [claimed] = await claimAiJobs(db, { workerId: "w-empty" });

    const emptyBilled: AiProvider = {
      id: "mock",
      async complete() {
        return {
          text: "",
          usage: {
            inputTokens: 500,
            outputTokens: 20,
            cachedInputTokens: 100,
            reasoningTokens: 5,
          },
          provider: "mock",
          model: "mock-v1",
          latencyMs: 3,
          providerResponseId: "resp_empty_test",
        };
      },
    };

    const result = await executeAiJob(db, {
      job: claimed,
      workerId: "w-empty",
      provider: emptyBilled,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_output");

    const job = await getAiJobById(db, enq.job.id);
    expect(job?.status).toBe("failed");
    expect(job?.providerOutcome).toBe("failed");
    expect(job?.errorCode).toBe("empty_output_with_usage");

    const [usage] = await db
      .select()
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.id, enq.job.usageEventId!));
    expect(usage.status).toBe("invalid_output");
    expect(usage.cachedInputTokens).toBe(100);
    expect(usage.reasoningTokens).toBe(5);
    expect(usage.providerResponseId).toBe("resp_empty_test");
    expect(Number(usage.estimatedCostUsd)).toBeGreaterThan(0);
    expect(usage.pricingVersion).toBe("2026-11-17");

    const budget = await getAiDailyBudgetCounter(db, "user", user.id);
    expect(Number(budget!.reservedUsd)).toBe(0);
    expect(Number(budget!.spentUsd)).toBeGreaterThan(0);
  });

  it("settles when actual usage cost exceeds the reservation", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const enq = await enqueueOne(user.id, "短い");
    const [claimed] = await claimAiJobs(db, { workerId: "w-over" });
    const reservedUsd = (
      await db
        .select()
        .from(aiUsageEvents)
        .where(eq(aiUsageEvents.id, enq.job.usageEventId!))
    )[0]!.estimatedCostUsd;

    const expensive: AiProvider = {
      id: "mock",
      async complete() {
        return {
          text: "長い応答",
          usage: { inputTokens: 50_000, outputTokens: 10_000 },
          provider: "mock",
          model: "mock-v1",
          latencyMs: 2,
        };
      },
    };

    const result = await executeAiJob(db, {
      job: claimed,
      workerId: "w-over",
      provider: expensive,
    });
    expect(result.ok).toBe(true);

    const [usage] = await db
      .select()
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.id, enq.job.usageEventId!));
    expect(usage.status).toBe("ok");
    expect(Number(usage.estimatedCostUsd)).toBeGreaterThan(Number(reservedUsd));

    const budget = await getAiDailyBudgetCounter(db, "user", user.id);
    expect(Number(budget!.reservedUsd)).toBe(0);
    expect(Number(budget!.spentUsd)).toBeCloseTo(
      Number(usage.estimatedCostUsd),
      5,
    );
  });
});
