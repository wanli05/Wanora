import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { aiDailyBudgetCounters, aiUsageEvents, users } from "@/db/schema";
import { guardedComplete } from "@/lib/ai/guard";
import { createMockAiProvider } from "@/lib/ai/providers/mock";
import { getAiDailyBudgetCounter } from "@/lib/data/ai-budget";
import { resetServerEnvCache } from "@/lib/env";

function newUser(name = "Guard Test") {
  return {
    id: randomUUID(),
    name,
    email: `${randomUUID()}@example.test`,
  };
}

function setAiEnv(overrides: Record<string, string> = {}) {
  process.env.AI_ENABLED = "true";
  process.env.AI_PROVIDER = "mock";
  process.env.AI_RATE_LIMIT_PER_MINUTE = "5";
  process.env.AI_DAILY_TOKEN_BUDGET = "100000";
  process.env.AI_DAILY_COST_BUDGET_USD = "1";
  process.env.AI_GLOBAL_DAILY_COST_BUDGET_USD = "20";
  Object.assign(process.env, overrides);
  resetServerEnvCache();
}

beforeEach(() => {
  setAiEnv();
});

afterEach(() => {
  delete process.env.AI_ENABLED;
  delete process.env.AI_RATE_LIMIT_PER_MINUTE;
  delete process.env.AI_DAILY_TOKEN_BUDGET;
  delete process.env.AI_DAILY_COST_BUDGET_USD;
  delete process.env.AI_GLOBAL_DAILY_COST_BUDGET_USD;
  resetServerEnvCache();
});

describe("guardedComplete integration", () => {
  it("completes via mock and records usage without storing message body", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const body = "履歴書の職務要約を日本語で改善してください";

    const outcome = await guardedComplete(db, {
      userId: user.id,
      requestId: randomUUID(),
      feature: "chat",
      messages: [{ role: "user", content: body }],
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.text).toContain("【モック応答】");
    expect(outcome.result.provider).toBe("mock");

    const [row] = await db
      .select()
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.id, outcome.usageEventId));
    expect(row.status).toBe("ok");
    expect(row.provider).toBe("mock");
    expect(row.model).toBe("mock-v1");
    expect(row.inputTokens).toBeGreaterThan(0);
    expect(row.outputTokens).toBeGreaterThan(0);
    expect(Number(row.estimatedCostUsd)).toBeGreaterThan(0);
    expect(row.latencyMs).toBeGreaterThan(0);
    expect(JSON.stringify(row)).not.toContain(body);

    const userBudget = await getAiDailyBudgetCounter(db, "user", user.id);
    expect(userBudget).not.toBeNull();
    expect(Number(userBudget!.spentUsd)).toBeGreaterThan(0);
    expect(Number(userBudget!.reservedUsd)).toBe(0);
  });

  it("is idempotent for the same requestId after success", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const requestId = randomUUID();
    const messages = [{ role: "user" as const, content: "冪等テスト" }];

    const first = await guardedComplete(db, {
      userId: user.id,
      requestId,
      feature: "chat",
      messages,
    });
    const second = await guardedComplete(db, {
      userId: user.id,
      requestId,
      feature: "chat",
      messages,
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.replayed).toBe(true);
    expect(second.usageEventId).toBe(first.usageEventId);

    const rows = await db
      .select()
      .from(aiUsageEvents)
      .where(
        and(
          eq(aiUsageEvents.userId, user.id),
          eq(aiUsageEvents.requestId, requestId),
          eq(aiUsageEvents.status, "ok"),
        ),
      );
    expect(rows).toHaveLength(1);

    const budget = await getAiDailyBudgetCounter(db, "user", user.id);
    // Charged once (replay must not double-spend).
    expect(Number(budget!.spentUsd)).toBeCloseTo(
      Number(rows[0].estimatedCostUsd),
      5,
    );
  });

  it("rejects when user cost budget is exceeded", async () => {
    setAiEnv({ AI_DAILY_COST_BUDGET_USD: "0.00001" });
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);

    const outcome = await guardedComplete(db, {
      userId: user.id,
      requestId: randomUUID(),
      feature: "chat",
      messages: [
        {
          role: "user",
          content: "これは十分に長い入力でトークン費用見積もりを押し上げます".repeat(
            3,
          ),
        },
      ],
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.code).toBe("budget_exceeded");

    const [row] = await db
      .select()
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.id, outcome.usageEventId!));
    expect(row.status).toBe("rejected_budget");
  });

  it("rejects when daily token budget is exceeded", async () => {
    setAiEnv({ AI_DAILY_TOKEN_BUDGET: "10" });
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);

    const outcome = await guardedComplete(db, {
      userId: user.id,
      requestId: randomUUID(),
      feature: "chat",
      messages: [
        {
          role: "user",
          content: "トークン予算超過テスト用の長い文章です。".repeat(5),
        },
      ],
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.code).toBe("budget_exceeded");
    expect(outcome.detail).toMatch(/tokens/);
  });

  it("enforces per-user rate limit via Postgres, not process memory", async () => {
    setAiEnv({ AI_RATE_LIMIT_PER_MINUTE: "2" });
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);

    const ok1 = await guardedComplete(db, {
      userId: user.id,
      requestId: randomUUID(),
      feature: "chat",
      messages: [{ role: "user", content: "1" }],
    });
    const ok2 = await guardedComplete(db, {
      userId: user.id,
      requestId: randomUUID(),
      feature: "chat",
      messages: [{ role: "user", content: "2" }],
    });
    const limited = await guardedComplete(db, {
      userId: user.id,
      requestId: randomUUID(),
      feature: "chat",
      messages: [{ role: "user", content: "3" }],
    });

    expect(ok1.ok).toBe(true);
    expect(ok2.ok).toBe(true);
    expect(limited.ok).toBe(false);
    if (limited.ok) return;
    expect(limited.code).toBe("rate_limited");
  });

  it("isolates rate limits and budgets across users", async () => {
    setAiEnv({ AI_RATE_LIMIT_PER_MINUTE: "1", AI_DAILY_COST_BUDGET_USD: "1" });
    const db = getDb();
    const a = newUser("A");
    const b = newUser("B");
    await db.insert(users).values([a, b]);

    const a1 = await guardedComplete(db, {
      userId: a.id,
      requestId: randomUUID(),
      feature: "chat",
      messages: [{ role: "user", content: "a1" }],
    });
    const a2 = await guardedComplete(db, {
      userId: a.id,
      requestId: randomUUID(),
      feature: "chat",
      messages: [{ role: "user", content: "a2" }],
    });
    const b1 = await guardedComplete(db, {
      userId: b.id,
      requestId: randomUUID(),
      feature: "chat",
      messages: [{ role: "user", content: "b1" }],
    });

    expect(a1.ok).toBe(true);
    expect(a2.ok).toBe(false);
    expect(b1.ok).toBe(true);
  });

  it("handles concurrent calls without overspending the user budget", async () => {
    // Cap just above one typical mock call (~tens of tokens * 1e-5).
    setAiEnv({ AI_DAILY_COST_BUDGET_USD: "0.001", AI_RATE_LIMIT_PER_MINUTE: "50" });
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);

    const messages = [
      {
        role: "user" as const,
        content: "同時実行の予算テスト",
      },
    ];

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        guardedComplete(db, {
          userId: user.id,
          requestId: randomUUID(),
          feature: "chat",
          messages,
        }),
      ),
    );

    const successes = results.filter((r) => r.ok);
    const budgetFails = results.filter(
      (r) => !r.ok && r.code === "budget_exceeded",
    );
    expect(successes.length).toBeGreaterThanOrEqual(1);
    expect(successes.length + budgetFails.length).toBe(8);

    const budget = await getAiDailyBudgetCounter(db, "user", user.id);
    expect(Number(budget!.reservedUsd)).toBe(0);
    expect(Number(budget!.spentUsd)).toBeLessThanOrEqual(0.001 + 1e-9);
  });

  it("recovers from a stale reserved row (crash simulation)", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const requestId = randomUUID();

    // Simulate crash after reserve: insert reserved + bump counters manually
    // via a partial guarded path — insert reserved usage and reserve budget.
    const { reserveAiDailyBudget } = await import("@/lib/data/ai-budget");
    const { insertAiUsageEvent } = await import("@/lib/data/ai-usage");

    await db.transaction(async (tx) => {
      await reserveAiDailyBudget(tx, {
        userId: user.id,
        estimateUsd: "0.000500",
        userBudgetUsd: 1,
        globalBudgetUsd: 20,
      });
      await insertAiUsageEvent(tx, user.id, {
        feature: "chat",
        provider: "mock",
        status: "reserved",
        estimatedCostUsd: "0.000500",
        requestId,
        inputTokens: 50,
      });
    });

    // Backdate created_at so the reservation is considered stale.
    await db
      .update(aiUsageEvents)
      .set({ createdAt: new Date(Date.now() - 120_000) })
      .where(
        and(
          eq(aiUsageEvents.userId, user.id),
          eq(aiUsageEvents.requestId, requestId),
        ),
      );

    const outcome = await guardedComplete(db, {
      userId: user.id,
      requestId,
      feature: "chat",
      messages: [{ role: "user", content: "回復テスト" }],
      provider: createMockAiProvider(),
    });

    expect(outcome.ok).toBe(true);

    const statuses = await db
      .select({ status: aiUsageEvents.status, errorCode: aiUsageEvents.errorCode })
      .from(aiUsageEvents)
      .where(
        and(
          eq(aiUsageEvents.userId, user.id),
          eq(aiUsageEvents.requestId, requestId),
        ),
      );

    expect(statuses.some((s) => s.status === "ok")).toBe(true);
    expect(
      statuses.some(
        (s) =>
          s.status === "error" && s.errorCode === "abandoned_reservation",
      ),
    ).toBe(true);

    const budget = await getAiDailyBudgetCounter(db, "user", user.id);
    expect(Number(budget!.reservedUsd)).toBe(0);
  });

  it("releases budget when the provider throws", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);

    const flaky = {
      id: "mock",
      async complete() {
        throw new Error("provider boom");
      },
    };

    await expect(
      guardedComplete(db, {
        userId: user.id,
        requestId: randomUUID(),
        feature: "chat",
        messages: [{ role: "user", content: "fail" }],
        provider: flaky,
      }),
    ).rejects.toThrow(/provider boom/);

    const budget = await getAiDailyBudgetCounter(db, "user", user.id);
    expect(Number(budget!.reservedUsd)).toBe(0);
    expect(Number(budget!.spentUsd)).toBe(0);

    const rows = await db
      .select()
      .from(aiUsageEvents)
      .where(
        and(
          eq(aiUsageEvents.userId, user.id),
          inArray(aiUsageEvents.status, ["error"]),
        ),
      );
    expect(rows).toHaveLength(1);
    expect(rows[0].errorCode).toBe("provider_error");
  });

  it("does not let one user spend another user's budget counters", async () => {
    const db = getDb();
    const a = newUser("A");
    const b = newUser("B");
    await db.insert(users).values([a, b]);

    await guardedComplete(db, {
      userId: a.id,
      requestId: randomUUID(),
      feature: "chat",
      messages: [{ role: "user", content: "only A" }],
    });

    const aBudget = await getAiDailyBudgetCounter(db, "user", a.id);
    const bBudget = await getAiDailyBudgetCounter(db, "user", b.id);
    expect(Number(aBudget!.spentUsd)).toBeGreaterThan(0);
    expect(bBudget).toBeNull();

    const bRows = await db
      .select()
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.userId, b.id));
    expect(bRows).toHaveLength(0);

    // Ensure we did not create stray counters for B via global only.
    const stray = await db
      .select()
      .from(aiDailyBudgetCounters)
      .where(
        and(
          eq(aiDailyBudgetCounters.scopeType, "user"),
          eq(aiDailyBudgetCounters.scopeId, b.id),
        ),
      );
    expect(stray).toHaveLength(0);
  });
});
