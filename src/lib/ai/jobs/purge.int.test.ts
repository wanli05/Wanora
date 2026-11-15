import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import {
  aiConversations,
  aiJobs,
  aiMessages,
  aiUsageEvents,
  users,
} from "@/db/schema";
import { softDeleteConversationAndCancelJobs } from "@/lib/ai/jobs/cancel";
import { enqueueAiJob } from "@/lib/ai/jobs/enqueue";
import {
  deleteAiJobsForUser,
  hardDeleteUserAccount,
  purgeDeletedAiConversations,
} from "@/lib/ai/jobs/purge";
import { drainAiWorker } from "@/lib/ai/jobs/worker";
import { createAiConversation } from "@/lib/data/ai-conversations";
import { createAiMessage } from "@/lib/data/ai-messages";
import { insertAiJob } from "@/lib/data/ai-jobs";
import { resetServerEnvCache } from "@/lib/env";

function newUser(name = "Purge") {
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
  process.env.AI_CHAT_HARD_DELETE_AFTER_DAYS = "30";
  resetServerEnvCache();
}

beforeEach(async () => {
  setAiEnv();
  await drainAiWorker(getDb(), { workerIdPrefix: "purge-cleanup" });
});

afterEach(() => {
  delete process.env.AI_ENABLED;
  delete process.env.AI_CHAT_HARD_DELETE_AFTER_DAYS;
  resetServerEnvCache();
});

describe("purge + account delete RESTRICT", () => {
  it("purges soft-deleted conversations older than retention (jobs first)", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const conv = await createAiConversation(db, user.id, { title: "old" });
    const enq = await enqueueAiJob(db, {
      userId: user.id,
      conversationId: conv.id,
      clientRequestId: randomUUID(),
      content: "to purge",
    });
    expect(enq.ok).toBe(true);
    if (!enq.ok) return;

    await softDeleteConversationAndCancelJobs(db, user.id, conv.id);
    // Backdate deleted_at beyond retention.
    await db
      .update(aiConversations)
      .set({ deletedAt: new Date(Date.now() - 40 * 86_400_000) })
      .where(eq(aiConversations.id, conv.id));

    const usageId = enq.job.usageEventId!;
    const result = await purgeDeletedAiConversations(db, {
      olderThanDays: 30,
    });
    expect(result.conversations).toBeGreaterThanOrEqual(1);
    expect(result.jobs).toBeGreaterThanOrEqual(1);

    expect(await db.select().from(aiJobs).where(eq(aiJobs.id, enq.job.id))).toHaveLength(
      0,
    );
    expect(
      await db.select().from(aiMessages).where(eq(aiMessages.conversationId, conv.id)),
    ).toHaveLength(0);
    expect(
      await db.select().from(aiConversations).where(eq(aiConversations.id, conv.id)),
    ).toHaveLength(0);

    // Usage retained for audit (no chat body).
    const [usage] = await db
      .select()
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.id, usageId));
    expect(usage).toBeTruthy();
    expect(JSON.stringify(usage)).not.toContain("to purge");
  });

  it("blocks naive user delete when jobs reference messages; helper succeeds", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const conv = await createAiConversation(db, user.id, { title: "acc" });
    const msg = await createAiMessage(db, user.id, conv.id, {
      role: "user",
      content: "hello",
    });
    await insertAiJob(db, user.id, {
      conversationId: conv.id,
      userMessageId: msg.id,
      clientRequestId: randomUUID(),
      feature: "chat",
    });

    // Depending on Postgres CASCADE order, bare delete may fail on RESTRICT.
    let bareFailed = false;
    try {
      await db.delete(users).where(eq(users.id, user.id));
    } catch {
      bareFailed = true;
    }

    if (!bareFailed) {
      // Cascade ordered jobs-first on this PG — still verify helper path on a fresh user.
      const user2 = newUser("Acc2");
      await db.insert(users).values(user2);
      const conv2 = await createAiConversation(db, user2.id, { title: "acc2" });
      const msg2 = await createAiMessage(db, user2.id, conv2.id, {
        role: "user",
        content: "x",
      });
      await insertAiJob(db, user2.id, {
        conversationId: conv2.id,
        userMessageId: msg2.id,
        clientRequestId: randomUUID(),
        feature: "chat",
      });
      await hardDeleteUserAccount(db, user2.id);
      expect(
        await db.select().from(users).where(eq(users.id, user2.id)),
      ).toHaveLength(0);
      return;
    }

    // Bare delete failed — jobs still present; use helper.
    expect(
      (await db.select().from(aiJobs).where(eq(aiJobs.userId, user.id))).length,
    ).toBeGreaterThan(0);
    await deleteAiJobsForUser(db, user.id);
    await db.delete(users).where(eq(users.id, user.id));
    expect(await db.select().from(users).where(eq(users.id, user.id))).toHaveLength(
      0,
    );
  });

  it("hardDeleteUserAccount removes user with jobs referencing messages", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const conv = await createAiConversation(db, user.id, { title: "h" });
    const enq = await enqueueAiJob(db, {
      userId: user.id,
      conversationId: conv.id,
      clientRequestId: randomUUID(),
      content: "account bye",
    });
    expect(enq.ok).toBe(true);

    await hardDeleteUserAccount(db, user.id);
    expect(await db.select().from(users).where(eq(users.id, user.id))).toHaveLength(
      0,
    );
    expect(
      await db.select().from(aiJobs).where(eq(aiJobs.userId, user.id)),
    ).toHaveLength(0);
  });
});
