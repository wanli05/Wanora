/**
 * Phase B reliability: Fake OpenAI SDK → executeAiJob, settlement TX inject,
 * global budget, dual-user career isolation. Mock/Fake only — no live API.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  APIConnectionError,
  APIError,
  AuthenticationError,
  InternalServerError,
  PermissionDeniedError,
  RateLimitError,
} from "openai";
import { getDb } from "@/db";
import { aiJobs, aiMessages, aiUsageEvents, users } from "@/db/schema";
import { enqueueAiJob } from "@/lib/ai/jobs/enqueue";
import { executeAiJob } from "@/lib/ai/jobs/execute";
import { recoverExpiredAiJobLeases } from "@/lib/ai/jobs/recover";
import { drainAiWorker } from "@/lib/ai/jobs/worker";
import { buildAiChatMessages } from "@/lib/ai/prompt-build";
import { resolveAiContext } from "@/lib/ai/context";
import { createOpenAiProvider } from "@/lib/ai/providers/openai";
import type { OpenAiResponsesClient } from "@/lib/ai/providers/openai";
import { createAiConversation } from "@/lib/data/ai-conversations";
import {
  claimAiJobs,
  forceAiJobLeaseExpiry,
  getAiJobById,
} from "@/lib/data/ai-jobs";
import { getAiDailyBudgetCounter } from "@/lib/data/ai-budget";
import { createCareerProject } from "@/lib/data/career-projects";
import { upsertProfile } from "@/lib/data/profiles";
import { yearMonthFromInput } from "@/lib/domain/dates";
import { resetServerEnvCache } from "@/lib/env";
import { AI_B1_DEFAULT_MODEL } from "@/lib/env";
import type { AiProvider } from "@/lib/ai/types";
import type { Response as OpenAIResponse } from "openai/resources/responses/responses";
import * as budgetMod from "@/lib/ai/budget";

function newUser(name = "Reliability") {
  return {
    id: randomUUID(),
    name,
    email: `${randomUUID()}@example.test`,
  };
}

function setAiEnv(overrides: Record<string, string> = {}) {
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
  process.env.AI_DEFAULT_MODEL = AI_B1_DEFAULT_MODEL;
  process.env.OPENAI_API_KEY = "test-key-not-used-on-wire";
  Object.assign(process.env, overrides);
  resetServerEnvCache();
}

function headers() {
  return new Headers();
}

function stubOkResponse(text = "ok"): OpenAIResponse {
  return {
    id: "resp_ok",
    object: "response",
    created_at: 1,
    status: "completed",
    model: AI_B1_DEFAULT_MODEL,
    output: [],
    output_text: text,
    usage: {
      input_tokens: 20,
      output_tokens: 5,
      total_tokens: 25,
      input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
      output_tokens_details: { reasoning_tokens: 0 },
    },
  } as unknown as OpenAIResponse;
}

beforeEach(async () => {
  setAiEnv();
  delete process.env.OPENAI_API_KEY;
  setAiEnv({ OPENAI_API_KEY: "fake-for-adapter-tests" });
  await drainAiWorker(getDb(), { workerIdPrefix: "rel-cleanup" });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.AI_ENABLED;
  delete process.env.AI_RATE_LIMIT_PER_MINUTE;
  delete process.env.AI_DAILY_TOKEN_BUDGET;
  delete process.env.AI_DAILY_COST_BUDGET_USD;
  delete process.env.AI_DAILY_JOB_LIMIT;
  delete process.env.AI_MAX_CONCURRENT_JOBS;
  delete process.env.AI_GLOBAL_DAILY_COST_BUDGET_USD;
  delete process.env.OPENAI_API_KEY;
  resetServerEnvCache();
});

async function enqueueOne(userId: string, content = "信頼性テスト") {
  const db = getDb();
  const conv = await createAiConversation(db, userId, { title: "rel" });
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

function openaiProviderFromClient(
  client: OpenAiResponsesClient,
): AiProvider {
  // Use real env after setAiEnv so adapter reads openai + key.
  process.env.AI_PROVIDER = "openai";
  resetServerEnvCache();
  return createOpenAiProvider({ client });
}

describe("Fake SDK → executeAiJob error matrix", () => {
  async function runWithThrowingCreate(
    throwFn: () => never,
  ): Promise<{
    providerCalls: number;
    jobId: string;
    userId: string;
    usageEventId: string;
    exec: Awaited<ReturnType<typeof executeAiJob>>;
  }> {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const enq = await enqueueOne(user.id);
    const [claimed] = await claimAiJobs(db, { workerId: "rel-err" });
    let providerCalls = 0;
    const client: OpenAiResponsesClient = {
      responses: {
        create: async () => {
          providerCalls += 1;
          throwFn();
        },
      },
    };
    const provider = openaiProviderFromClient(client);
    const exec = await executeAiJob(db, {
      job: claimed,
      workerId: "rel-err",
      provider,
    });
    return {
      providerCalls,
      jobId: enq.job.id,
      userId: user.id,
      usageEventId: enq.job.usageEventId!,
      exec,
    };
  }

  it("401 auth → failed clean; releases reserve; no assistant; calls=1", async () => {
    const db = getDb();
    const r = await runWithThrowingCreate(() => {
      throw new AuthenticationError(
        401,
        { message: "nope" },
        "nope",
        headers(),
      );
    });
    expect(r.providerCalls).toBe(1);
    expect(r.exec.ok).toBe(false);
    const job = await getAiJobById(db, r.jobId);
    expect(job?.status).toBe("failed");
    expect(job?.providerOutcome).toBe("failed");
    expect(job?.errorCode).toBe("provider_auth");
    expect(job?.resultMessageId).toBeNull();
    const [usage] = await db
      .select()
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.id, r.usageEventId));
    expect(usage.status).toBe("error");
    expect(Number(usage.estimatedCostUsd)).toBe(0);
    const budget = await getAiDailyBudgetCounter(db, "user", r.userId);
    expect(Number(budget!.reservedUsd)).toBe(0);
  });

  it("403 permission → failed clean; calls=1", async () => {
    const db = getDb();
    const r = await runWithThrowingCreate(() => {
      throw new PermissionDeniedError(
        403,
        { message: "forbidden" },
        "forbidden",
        headers(),
      );
    });
    expect(r.providerCalls).toBe(1);
    const job = await getAiJobById(db, r.jobId);
    expect(job?.status).toBe("failed");
    expect(job?.providerOutcome).toBe("failed");
    expect(job?.errorCode).toBe("provider_auth");
  });

  it("429 rate limit → failed clean (no auto retry); calls=1", async () => {
    const db = getDb();
    const r = await runWithThrowingCreate(() => {
      throw new RateLimitError(429, { message: "slow" }, "slow", headers());
    });
    expect(r.providerCalls).toBe(1);
    const job = await getAiJobById(db, r.jobId);
    expect(job?.status).toBe("failed");
    expect(job?.providerOutcome).toBe("failed");
    expect(job?.errorCode).toBe("provider_rate_limited");
    const reclaimed = await claimAiJobs(db, {
      workerId: "retry-429",
      limit: 5,
    });
    expect(reclaimed.find((j) => j.id === r.jobId)).toBeUndefined();
  });

  it("500 → uncertain; holds reserve; no auto reclaim; calls=1", async () => {
    const db = getDb();
    const r = await runWithThrowingCreate(() => {
      throw new InternalServerError(500, { message: "boom" }, "boom", headers());
    });
    expect(r.providerCalls).toBe(1);
    const job = await getAiJobById(db, r.jobId);
    expect(job?.status).toBe("failed");
    expect(job?.providerOutcome).toBe("uncertain");
    const [usage] = await db
      .select()
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.id, r.usageEventId));
    expect(usage.status).toBe("reserved");
    const reclaimed = await claimAiJobs(db, {
      workerId: "retry-500",
      limit: 5,
    });
    expect(reclaimed.find((j) => j.id === r.jobId)).toBeUndefined();
  });

  it("503 via APIError → uncertain; calls=1", async () => {
    const db = getDb();
    const r = await runWithThrowingCreate(() => {
      throw APIError.generate(503, { message: "unavailable" }, "unavailable", headers());
    });
    expect(r.providerCalls).toBe(1);
    const job = await getAiJobById(db, r.jobId);
    expect(job?.providerOutcome).toBe("uncertain");
    expect(job?.errorCode).toBe("provider_5xx");
  });

  it("connection error → uncertain; calls=1", async () => {
    const db = getDb();
    const r = await runWithThrowingCreate(() => {
      throw new APIConnectionError({ message: "offline" });
    });
    expect(r.providerCalls).toBe(1);
    const job = await getAiJobById(db, r.jobId);
    expect(job?.status).toBe("failed");
    expect(job?.providerOutcome).toBe("uncertain");
    expect(job?.errorCode).toBe("provider_connection");
  });

  it("incomplete with usage → failed + billed; no assistant message; calls=1", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const enq = await enqueueOne(user.id);
    const [claimed] = await claimAiJobs(db, { workerId: "rel-inc" });
    let providerCalls = 0;
    const client: OpenAiResponsesClient = {
      responses: {
        create: async () => {
          providerCalls += 1;
          return {
            ...stubOkResponse("途中まで生成された文"),
            id: "resp_incomplete",
            status: "incomplete",
            incomplete_details: { reason: "max_output_tokens" },
            usage: {
              input_tokens: 100,
              output_tokens: 40,
              total_tokens: 140,
              input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
              output_tokens_details: { reasoning_tokens: 0 },
            },
          } as unknown as OpenAIResponse;
        },
      },
    };
    const exec = await executeAiJob(db, {
      job: claimed,
      workerId: "rel-inc",
      provider: openaiProviderFromClient(client),
    });
    expect(providerCalls).toBe(1);
    expect(exec.ok).toBe(false);
    if (!exec.ok) expect(exec.reason).toBe("invalid_output");

    const job = await getAiJobById(db, enq.job.id);
    expect(job?.status).toBe("failed");
    expect(job?.providerOutcome).toBe("failed");
    expect(job?.errorCode).toBe("incomplete_output");
    expect(job?.resultMessageId).toBeNull();
    expect(job?.resultPayload).toMatchObject({ incomplete: true });

    const assistants = await db
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, enq.job.conversationId));
    expect(assistants.filter((m) => m.role === "assistant")).toHaveLength(0);

    const [usage] = await db
      .select()
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.id, enq.job.usageEventId!));
    expect(usage.status).toBe("invalid_output");
    expect(usage.errorCode).toBe("incomplete_output");
    expect(usage.inputTokens).toBe(100);
    expect(usage.outputTokens).toBe(40);
    expect(Number(usage.estimatedCostUsd)).toBeGreaterThan(0);
    expect(usage.providerResponseId).toBe("resp_incomplete");

    const budget = await getAiDailyBudgetCounter(db, "user", user.id);
    expect(Number(budget!.reservedUsd)).toBe(0);
    expect(Number(budget!.spentUsd)).toBeGreaterThan(0);
  });
});

describe("global budget guard", () => {
  it("rejects enqueue when global daily cost budget is exhausted", async () => {
    const db = getDb();
    const user = newUser("GlobalBudget");
    await db.insert(users).values(user);
    const conv = await createAiConversation(db, user.id, { title: "g" });

    // User still has headroom; global is tiny so the next reserve fails globally.
    setAiEnv({
      AI_DAILY_COST_BUDGET_USD: "10",
      AI_GLOBAL_DAILY_COST_BUDGET_USD: "0",
    });

    const result = await enqueueAiJob(db, {
      userId: user.id,
      conversationId: conv.id,
      clientRequestId: randomUUID(),
      content: "グローバル予算",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("global_budget_exceeded");

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

    // Reject may create a zeroed counter row via FOR UPDATE lock helper, but
    // must not leave a positive reserve/spend for this user attempt.
    const userBudget = await getAiDailyBudgetCounter(db, "user", user.id);
    if (userBudget) {
      expect(Number(userBudget.reservedUsd)).toBe(0);
      expect(Number(userBudget.spentUsd)).toBe(0);
    }
  });
});

describe("settlement transaction failure", () => {
  it("rolls back settle side-effects and recovers as uncertain without re-calling provider", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const enq = await enqueueOne(user.id);
    const [claimed] = await claimAiJobs(db, {
      workerId: "rel-tx",
      leaseMs: 60_000,
    });

    let providerCalls = 0;
    const provider: AiProvider = {
      id: "mock",
      async complete() {
        providerCalls += 1;
        return {
          text: "成功したが settle 前に落ちる",
          usage: { inputTokens: 30, outputTokens: 10 },
          provider: "mock",
          model: "mock-v1",
          latencyMs: 2,
          providerResponseId: "resp_tx_fail",
        };
      },
    };

    const spy = vi
      .spyOn(budgetMod, "settleBudgets")
      .mockRejectedValueOnce(new Error("injected settle failure"));

    await expect(
      executeAiJob(db, {
        job: claimed,
        workerId: "rel-tx",
        provider,
      }),
    ).rejects.toThrow(/injected settle failure/);
    expect(providerCalls).toBe(1);
    expect(spy).toHaveBeenCalledOnce();

    const mid = await getAiJobById(db, enq.job.id);
    expect(mid?.status).toBe("running");
    expect(mid?.executionPhase).toBe("calling_provider");
    expect(mid?.resultMessageId).toBeNull();

    const [usageMid] = await db
      .select()
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.id, enq.job.usageEventId!));
    expect(usageMid.status).toBe("reserved");

    await forceAiJobLeaseExpiry(db, enq.job.id, new Date(Date.now() - 1_000));
    const recovered = await recoverExpiredAiJobLeases(db);
    expect(recovered.markedUncertain).toBeGreaterThanOrEqual(1);

    const after = await getAiJobById(db, enq.job.id);
    expect(after?.status).toBe("failed");
    expect(after?.providerOutcome).toBe("uncertain");

    const reclaimed = await claimAiJobs(db, {
      workerId: "rel-tx-2",
      limit: 10,
    });
    expect(reclaimed.find((j) => j.id === enq.job.id)).toBeUndefined();

    await drainAiWorker(db, {
      workerIdPrefix: "rel-tx-drain",
      provider: {
        id: "mock",
        async complete() {
          providerCalls += 1;
          throw new Error("must not re-call");
        },
      },
    });
    expect(providerCalls).toBe(1);

    // Real DB disconnect mid-settle is not simulated here — marked uncovered in report.
  });
});

describe("dual-user career context isolation", () => {
  it("keeps IT vs logistics career data out of each other's provider inputs", async () => {
    const db = getDb();
    const a = newUser("社内IT担当");
    const b = newUser("物流管理担当");
    await db.insert(users).values([a, b]);

    await upsertProfile(db, a.id, {
      fullName: { ja: "佐藤花子" },
      headline: "社内IT担当",
      selfPr: { ja: "要件整理とテスト支援を担当" },
      jobSummary: { ja: "社内業務システム改善" },
    });
    await createCareerProject(db, a.id, {
      title: { ja: "社内基幹システム刷新" },
      startYm: yearMonthFromInput(2023, 4),
      overview: { ja: "IT側の要件定義と開発調整" },
    });

    await upsertProfile(db, b.id, {
      fullName: { ja: "鈴木一郎" },
      headline: "物流管理担当",
      selfPr: { ja: "倉庫オペレーション改善" },
      jobSummary: { ja: "配送ルート最適化" },
    });
    await createCareerProject(db, b.id, {
      title: { ja: "東北倉庫WMS導入" },
      startYm: yearMonthFromInput(2022, 1),
      overview: { ja: "物流現場の在庫精度向上" },
    });

    const page = { path: "/ja/my-career", area: "my_career" as const };
    const ctxA = await resolveAiContext(db, {
      userId: a.id,
      pageContext: page,
    });
    const ctxB = await resolveAiContext(db, {
      userId: b.id,
      pageContext: page,
    });

    const jsonA = JSON.stringify(ctxA.fragments);
    const jsonB = JSON.stringify(ctxB.fragments);
    expect(jsonA).toContain("社内IT");
    expect(jsonA).toContain("基幹システム");
    expect(jsonA).not.toContain("物流管理");
    expect(jsonA).not.toContain("東北倉庫");
    expect(jsonA).not.toContain("鈴木一郎");

    expect(jsonB).toContain("物流");
    expect(jsonB).toContain("東北倉庫");
    expect(jsonB).not.toContain("社内IT");
    expect(jsonB).not.toContain("基幹システム");
    expect(jsonB).not.toContain("佐藤花子");

    const convA = await createAiConversation(db, a.id, { title: "A" });
    const convB = await createAiConversation(db, b.id, { title: "B" });
    const enqA = await enqueueAiJob(db, {
      userId: a.id,
      conversationId: convA.id,
      clientRequestId: randomUUID(),
      content: "自己PRを整えて",
      pageContext: page,
    });
    const enqB = await enqueueAiJob(db, {
      userId: b.id,
      conversationId: convB.id,
      clientRequestId: randomUUID(),
      content: "自己PRを整えて",
      pageContext: page,
    });
    expect(enqA.ok && enqB.ok).toBe(true);
    if (!enqA.ok || !enqB.ok) return;

    // Cross-user conversation enqueue rejected.
    const cross = await enqueueAiJob(db, {
      userId: a.id,
      conversationId: convB.id,
      clientRequestId: randomUUID(),
      content: "横断",
    });
    expect(cross.ok).toBe(false);

    const msgsA = buildAiChatMessages({
      fragments: ctxA.fragments,
      history: [{ role: "user", content: "自己PRを整えて" }],
    });
    const msgsB = buildAiChatMessages({
      fragments: ctxB.fragments,
      history: [{ role: "user", content: "自己PRを整えて" }],
    });
    const promptA = JSON.stringify(msgsA);
    const promptB = JSON.stringify(msgsB);
    expect(promptA).toContain("社内IT");
    expect(promptA).not.toContain("東北倉庫");
    expect(promptB).toContain("物流");
    expect(promptB).not.toContain("基幹システム");

    let seenA = "";
    let seenB = "";
    const providerA: AiProvider = {
      id: "mock",
      async complete(req) {
        seenA = JSON.stringify(req.messages);
        return {
          text: "A向けモック",
          usage: { inputTokens: 10, outputTokens: 5 },
          provider: "mock",
          model: "mock-v1",
          latencyMs: 1,
        };
      },
    };
    const providerB: AiProvider = {
      id: "mock",
      async complete(req) {
        seenB = JSON.stringify(req.messages);
        return {
          text: "B向けモック",
          usage: { inputTokens: 10, outputTokens: 5 },
          provider: "mock",
          model: "mock-v1",
          latencyMs: 1,
        };
      },
    };

    const [cA] = await claimAiJobs(db, { workerId: "wa", limit: 1 });
    // Claim may get either job (FIFO). Execute the matching owner with the right provider.
    const firstIsA = cA.userId === a.id;
    await executeAiJob(db, {
      job: cA,
      workerId: "wa",
      provider: firstIsA ? providerA : providerB,
    });
    const [cB] = await claimAiJobs(db, { workerId: "wb", limit: 1 });
    await executeAiJob(db, {
      job: cB,
      workerId: "wb",
      provider: cB.userId === a.id ? providerA : providerB,
    });

    expect(seenA).toContain("社内IT");
    expect(seenA).not.toContain("東北倉庫");
    expect(seenB).toContain("物流");
    expect(seenB).not.toContain("基幹システム");

    const jobA = await getAiJobById(db, enqA.job.id);
    const jobB = await getAiJobById(db, enqB.job.id);
    expect(jobA?.status).toBe("succeeded");
    expect(jobB?.status).toBe("succeeded");
    expect(jobA?.userId).toBe(a.id);
    expect(jobB?.userId).toBe(b.id);
  });
});
