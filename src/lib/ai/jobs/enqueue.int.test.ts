import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { aiJobs, aiMessages, aiUsageEvents, users } from "@/db/schema";
import { enqueueAiJob } from "@/lib/ai/jobs/enqueue";
import { drainAiWorker } from "@/lib/ai/jobs/worker";
import { createAiConversation } from "@/lib/data/ai-conversations";
import { getAiDailyBudgetCounter } from "@/lib/data/ai-budget";
import { resetServerEnvCache } from "@/lib/env";

function newUser(name = "Enqueue Test") {
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
  process.env.AI_DAILY_JOB_LIMIT = "100";
  process.env.AI_MAX_CONCURRENT_JOBS = "10";
  process.env.AI_GLOBAL_DAILY_COST_BUDGET_USD = "20";
  process.env.AI_OPENAI_MAX_OUTPUT_TOKENS = "64";
  process.env.AI_PRICING_VERSION = "2026-11-17";
  Object.assign(process.env, overrides);
  resetServerEnvCache();
}

beforeEach(() => {
  setAiEnv();
});

afterEach(async () => {
  // Do not leave queued jobs for later suites that share the Testcontainers DB.
  await drainAiWorker(getDb(), { workerIdPrefix: "enqueue-cleanup" });
  delete process.env.AI_ENABLED;
  delete process.env.AI_RATE_LIMIT_PER_MINUTE;
  delete process.env.AI_DAILY_TOKEN_BUDGET;
  delete process.env.AI_DAILY_COST_BUDGET_USD;
  delete process.env.AI_DAILY_JOB_LIMIT;
  delete process.env.AI_MAX_CONCURRENT_JOBS;
  delete process.env.AI_GLOBAL_DAILY_COST_BUDGET_USD;
  resetServerEnvCache();
});

describe("enqueueAiJob", () => {
  it("atomically creates usage(reserved) + user message + queued job", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const conv = await createAiConversation(db, user.id, { title: "q" });
    const clientRequestId = randomUUID();

    const result = await enqueueAiJob(db, {
      userId: user.id,
      conversationId: conv.id,
      clientRequestId,
      content: "職務要約を直してください",
      pageContext: { path: "/ja/my-career", area: "my_career" },
      targetContext: { type: "profile", section: "job_summary" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.replayed).toBe(false);
    expect(result.job.status).toBe("queued");
    expect(result.job.userMessageId).toBe(result.userMessage.id);
    expect(result.job.usageEventId).toBeTruthy();
    expect(result.job.pageContext).toMatchObject({
      path: "/ja/my-career",
      area: "my_career",
    });
    expect(result.job.targetContext).toMatchObject({
      type: "profile",
      section: "job_summary",
    });

    const [usage] = await db
      .select()
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.id, result.job.usageEventId!));
    expect(usage.status).toBe("reserved");
    expect(usage.requestId).toBe(clientRequestId);

    const [msg] = await db
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.id, result.userMessage.id));
    expect(msg.role).toBe("user");
    expect(msg.content).toContain("職務要約");

    const budget = await getAiDailyBudgetCounter(db, "user", user.id);
    expect(Number(budget!.reservedUsd)).toBeGreaterThan(0);
  });

  it("is concurrent-safe idempotent for the same clientRequestId", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const conv = await createAiConversation(db, user.id, { title: "idem" });
    const clientRequestId = randomUUID();
    const input = {
      userId: user.id,
      conversationId: conv.id,
      clientRequestId,
      content: "同じリクエスト",
    };

    const [a, b] = await Promise.all([
      enqueueAiJob(db, input),
      enqueueAiJob(db, input),
    ]);

    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.job.id).toBe(b.job.id);
    expect(a.userMessage.id).toBe(b.userMessage.id);
    expect([a.replayed, b.replayed].filter(Boolean).length).toBeGreaterThanOrEqual(
      1,
    );

    const jobs = await db
      .select()
      .from(aiJobs)
      .where(eq(aiJobs.userId, user.id));
    expect(jobs).toHaveLength(1);

    const usages = await db
      .select()
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.userId, user.id));
    expect(usages.filter((u) => u.requestId === clientRequestId)).toHaveLength(
      1,
    );

    const msgs = await db
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.userId, user.id));
    expect(msgs).toHaveLength(1);
  });

  it("rejects when daily cost budget is exceeded", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const conv = await createAiConversation(db, user.id, { title: "budget" });
    setAiEnv({ AI_DAILY_COST_BUDGET_USD: "0" });

    const result = await enqueueAiJob(db, {
      userId: user.id,
      conversationId: conv.id,
      clientRequestId: randomUUID(),
      content: "予算オーバー",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("budget_exceeded");

    const jobs = await db
      .select()
      .from(aiJobs)
      .where(eq(aiJobs.userId, user.id));
    expect(jobs).toHaveLength(0);
    const msgs = await db
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.userId, user.id));
    expect(msgs).toHaveLength(0);
  });

  it("rejects a second concurrent open job for the same user", async () => {
    const db = getDb();
    const user = newUser("Concurrent");
    await db.insert(users).values(user);
    const conv = await createAiConversation(db, user.id, { title: "c" });
    setAiEnv({ AI_MAX_CONCURRENT_JOBS: "1" });

    const first = await enqueueAiJob(db, {
      userId: user.id,
      conversationId: conv.id,
      clientRequestId: randomUUID(),
      content: "first",
    });
    expect(first.ok).toBe(true);

    const second = await enqueueAiJob(db, {
      userId: user.id,
      conversationId: conv.id,
      clientRequestId: randomUUID(),
      content: "second",
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe("job_in_progress");
  });

  it("rejects when daily success+open job limit is reached", async () => {
    const db = getDb();
    const user = newUser("DailyLimit");
    await db.insert(users).values(user);
    const conv = await createAiConversation(db, user.id, { title: "d" });
    setAiEnv({ AI_DAILY_JOB_LIMIT: "1", AI_MAX_CONCURRENT_JOBS: "2" });

    const first = await enqueueAiJob(db, {
      userId: user.id,
      conversationId: conv.id,
      clientRequestId: randomUUID(),
      content: "slot-1",
    });
    expect(first.ok).toBe(true);

    const second = await enqueueAiJob(db, {
      userId: user.id,
      conversationId: conv.id,
      clientRequestId: randomUUID(),
      content: "slot-2",
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe("daily_limit_exceeded");
  });

  it("concurrent last USD slot: losers get budget_exceeded and create no jobs", async () => {
    const db = getDb();
    const user = newUser("LastSlot");
    await db.insert(users).values(user);
    const conv = await createAiConversation(db, user.id, { title: "slot" });
    // Cap allows ~1–2 full-context reserves (same approach as guard.int).
    setAiEnv({
      AI_DAILY_COST_BUDGET_USD: "0.01",
      AI_MAX_CONCURRENT_JOBS: "10",
      AI_DAILY_JOB_LIMIT: "20",
      AI_OPENAI_MAX_OUTPUT_TOKENS: "64",
    });

    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        enqueueAiJob(db, {
          userId: user.id,
          conversationId: conv.id,
          clientRequestId: randomUUID(),
          content: `競合${i}`,
        }),
      ),
    );

    const ok = results.filter((r) => r.ok);
    const budgetFails = results.filter(
      (r) => !r.ok && r.code === "budget_exceeded",
    );
    expect(ok.length).toBeGreaterThanOrEqual(1);
    expect(ok.length + budgetFails.length).toBe(8);

    // Rejected enqueues never create jobs → provider would never be called for them.
    const jobs = await db
      .select()
      .from(aiJobs)
      .where(eq(aiJobs.userId, user.id));
    expect(jobs.length).toBe(ok.length);

    const budget = await getAiDailyBudgetCounter(db, "user", user.id);
    expect(Number(budget!.reservedUsd)).toBeLessThanOrEqual(0.01 + 1e-9);
  });

  it("rejects archived or foreign conversations", async () => {
    const db = getDb();
    const owner = newUser("Owner");
    const other = newUser("Other");
    await db.insert(users).values([owner, other]);
    const conv = await createAiConversation(db, owner.id, { title: "mine" });
    const archived = await createAiConversation(db, owner.id, {
      title: "old",
    });
    const { updateAiConversation } = await import(
      "@/lib/data/ai-conversations"
    );
    await updateAiConversation(db, owner.id, archived.id, {
      status: "archived",
    });

    const archivedResult = await enqueueAiJob(db, {
      userId: owner.id,
      conversationId: archived.id,
      clientRequestId: randomUUID(),
      content: "archived",
    });
    expect(archivedResult.ok).toBe(false);
    if (!archivedResult.ok) expect(archivedResult.code).toBe("not_found");

    const cross = await enqueueAiJob(db, {
      userId: other.id,
      conversationId: conv.id,
      clientRequestId: randomUUID(),
      content: "cross",
    });
    expect(cross.ok).toBe(false);
    if (!cross.ok) expect(cross.code).toBe("not_found");
  });
});
