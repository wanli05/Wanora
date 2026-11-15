import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import {
  createAiConversation,
  getAiConversation,
  hardDeleteExpiredAiConversations,
  listAiConversations,
  softDeleteAiConversation,
} from "@/lib/data/ai-conversations";
import {
  createAiMessage,
  findAiMessageByClientId,
  listAiMessages,
} from "@/lib/data/ai-messages";
import {
  getAiDailyBudgetCounter,
  reserveAiDailyBudget,
  settleAiDailyBudget,
} from "@/lib/data/ai-budget";
import { insertAiUsageEvent } from "@/lib/data/ai-usage";

function newUser(name = "AI Test") {
  return {
    id: randomUUID(),
    name,
    email: `${randomUUID()}@example.test`,
  };
}

describe("ai data access", () => {
  it("isolates conversations and messages by userId", async () => {
    const db = getDb();
    const a = newUser("A");
    const b = newUser("B");
    await db.insert(users).values([a, b]);

    const convA = await createAiConversation(db, a.id, { title: "A chat" });
    await createAiMessage(db, a.id, convA.id, {
      role: "user",
      content: "こんにちは",
      clientMessageId: "client-a-1",
    });

    expect(await listAiConversations(db, a.id)).toHaveLength(1);
    expect(await listAiConversations(db, b.id)).toHaveLength(0);
    expect(await getAiConversation(db, b.id, convA.id)).toBeNull();
    expect(await listAiMessages(db, b.id, convA.id)).toHaveLength(0);
    expect(await listAiMessages(db, a.id, convA.id)).toHaveLength(1);

    await expect(
      createAiMessage(db, b.id, convA.id, {
        role: "user",
        content: "intrusion",
      }),
    ).rejects.toThrow();
  });

  it("soft-deletes conversations and hard-deletes after cutoff", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);

    const conv = await createAiConversation(db, user.id, { title: "to delete" });
    await createAiMessage(db, user.id, conv.id, {
      role: "user",
      content: "msg",
    });
    const usage = await insertAiUsageEvent(db, user.id, {
      feature: "chat",
      provider: "mock",
      model: "mock-v1",
      status: "ok",
      estimatedCostUsd: "0.01",
      conversationId: conv.id,
    });

    const soft = await softDeleteAiConversation(db, user.id, conv.id);
    expect(soft?.status).toBe("deleted");
    expect(soft?.deletedAt).toBeInstanceOf(Date);
    expect(await listAiConversations(db, user.id)).toHaveLength(0);

    const past = new Date(Date.now() + 60_000);
    const removed = await hardDeleteExpiredAiConversations(db, past);
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(await getAiConversation(db, user.id, conv.id)).toBeNull();

    // Usage row remains; conversation_id nulled by FK ON DELETE SET NULL.
    const { aiUsageEvents } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const [usageRow] = await db
      .select()
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.id, usage.id));
    expect(usageRow.userId).toBe(user.id);
    expect(usageRow.conversationId).toBeNull();
    expect(usageRow.estimatedCostUsd).toBe("0.010000");
  });

  it("enforces client_message_id uniqueness per user", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const conv = await createAiConversation(db, user.id);

    await createAiMessage(db, user.id, conv.id, {
      role: "user",
      content: "one",
      clientMessageId: "same-id",
    });
    await expect(
      createAiMessage(db, user.id, conv.id, {
        role: "user",
        content: "two",
        clientMessageId: "same-id",
      }),
    ).rejects.toThrow();

    const found = await findAiMessageByClientId(db, user.id, "same-id");
    expect(found?.content).toBe("one");
  });

  it("reserves daily budget atomically within a transaction", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);

    await db.transaction(async (tx) => {
      const first = await reserveAiDailyBudget(tx, {
        userId: user.id,
        estimateUsd: "0.80",
        userBudgetUsd: 1,
        globalBudgetUsd: 20,
      });
      expect(first).toEqual({ ok: true });

      const second = await reserveAiDailyBudget(tx, {
        userId: user.id,
        estimateUsd: "0.30",
        userBudgetUsd: 1,
        globalBudgetUsd: 20,
      });
      expect(second).toEqual({ ok: false, reason: "user_budget" });
    });

    const counter = await getAiDailyBudgetCounter(db, "user", user.id);
    expect(counter).not.toBeNull();
    expect(Number(counter!.reservedUsd)).toBeCloseTo(0.8, 5);

    await db.transaction(async (tx) => {
      await settleAiDailyBudget(tx, {
        userId: user.id,
        reservedUsd: "0.80",
        actualUsd: "0.50",
        success: true,
      });
    });

    const settled = await getAiDailyBudgetCounter(db, "user", user.id);
    expect(Number(settled!.reservedUsd)).toBeCloseTo(0, 5);
    expect(Number(settled!.spentUsd)).toBeCloseTo(0.5, 5);
  });
});
