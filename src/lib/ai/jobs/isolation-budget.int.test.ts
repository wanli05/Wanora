/**
 * Brief coverage: dual-account isolation + success counts once + duplicate replay.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { aiJobs, aiUsageEvents, users } from "@/db/schema";
import { enqueueAiJob } from "@/lib/ai/jobs/enqueue";
import { executeAiJob } from "@/lib/ai/jobs/execute";
import { drainAiWorker } from "@/lib/ai/jobs/worker";
import { createAiConversation } from "@/lib/data/ai-conversations";
import { claimAiJobs, getAiJob } from "@/lib/data/ai-jobs";
import { upsertProfile } from "@/lib/data/profiles";
import { resetServerEnvCache } from "@/lib/env";

function newUser(name: string) {
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

beforeEach(async () => {
  setAiEnv();
  await drainAiWorker(getDb(), { workerIdPrefix: "iso-budget-cleanup" });
});

afterEach(() => {
  delete process.env.AI_ENABLED;
  delete process.env.AI_RATE_LIMIT_PER_MINUTE;
  delete process.env.AI_DAILY_TOKEN_BUDGET;
  delete process.env.AI_DAILY_COST_BUDGET_USD;
  delete process.env.AI_DAILY_JOB_LIMIT;
  delete process.env.AI_MAX_CONCURRENT_JOBS;
  delete process.env.AI_GLOBAL_DAILY_COST_BUDGET_USD;
  resetServerEnvCache();
});

describe("dual-account isolation + usage semantics", () => {
  it("B cannot read A's AI job; A's data stays intact", async () => {
    const db = getDb();
    const a = newUser("AccountA");
    const b = newUser("AccountB");
    await db.insert(users).values([a, b]);

    await upsertProfile(db, a.id, {
      fullName: { ja: "山田太郎" },
      selfPr: { ja: "Aの自己PR" },
    });
    await upsertProfile(db, b.id, {
      fullName: { ja: "佐藤花子" },
      selfPr: { ja: "Bの自己PR" },
    });

    const convA = await createAiConversation(db, a.id, { title: "a" });
    const enq = await enqueueAiJob(db, {
      userId: a.id,
      conversationId: convA.id,
      clientRequestId: randomUUID(),
      content: "自己PRを添削",
      feature: "self_pr_refine",
    });
    expect(enq.ok).toBe(true);
    if (!enq.ok) return;

    const stolen = await getAiJob(db, b.id, enq.job.id);
    expect(stolen).toBeNull();

    const owned = await getAiJob(db, a.id, enq.job.id);
    expect(owned?.id).toBe(enq.job.id);

    const crossEnqueue = await enqueueAiJob(db, {
      userId: b.id,
      conversationId: convA.id,
      clientRequestId: randomUUID(),
      content: "盗む",
    });
    expect(crossEnqueue.ok).toBe(false);
    if (!crossEnqueue.ok) expect(crossEnqueue.code).toBe("not_found");

    const [usage] = await db
      .select()
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.id, enq.job.usageEventId!));
    expect(usage.userId).toBe(a.id);
  });

  it("successful deliver counts once; duplicate clientRequestId replays", async () => {
    const db = getDb();
    const user = newUser("Once");
    await db.insert(users).values(user);
    const conv = await createAiConversation(db, user.id, { title: "once" });
    const clientRequestId = randomUUID();

    const first = await enqueueAiJob(db, {
      userId: user.id,
      conversationId: conv.id,
      clientRequestId,
      content: "職務要約を直して",
      feature: "job_summary_refine",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const replay = await enqueueAiJob(db, {
      userId: user.id,
      conversationId: conv.id,
      clientRequestId,
      content: "職務要約を直して",
      feature: "job_summary_refine",
    });
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.replayed).toBe(true);
    expect(replay.job.id).toBe(first.job.id);

    const [claimed] = await claimAiJobs(db, { workerId: "iso-once", limit: 1 });
    expect(claimed?.id).toBe(first.job.id);
    const executed = await executeAiJob(db, {
      job: claimed!,
      workerId: "iso-once",
    });
    expect(executed.ok).toBe(true);

    const jobs = await db
      .select()
      .from(aiJobs)
      .where(eq(aiJobs.userId, user.id));
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.status).toBe("succeeded");

    const usages = await db
      .select()
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.userId, user.id));
    const okUsages = usages.filter((u) => u.status === "ok");
    expect(okUsages).toHaveLength(1);
  });
});
