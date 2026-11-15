import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import {
  claimAiJobs,
  forceAiJobLeaseExpiry,
  getAiJobById,
  insertAiJob,
  renewAiJobLease,
  updateAiJobWithFence,
} from "@/lib/data/ai-jobs";
import { createAiConversation } from "@/lib/data/ai-conversations";
import { createAiMessage } from "@/lib/data/ai-messages";
import { insertAiUsageEvent } from "@/lib/data/ai-usage";

function newUser(name = "Jobs Test") {
  return {
    id: randomUUID(),
    name,
    email: `${randomUUID()}@example.test`,
  };
}

async function seedConversation(userId: string) {
  const db = getDb();
  const conv = await createAiConversation(db, userId, { title: "job-test" });
  const msg = await createAiMessage(db, userId, conv.id, {
    role: "user",
    content: "hello",
    clientMessageId: randomUUID(),
  });
  return { conv, msg };
}

describe("ai_jobs claim + fencing", () => {
  it("allows only one worker to claim the same queued job concurrently", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const { conv, msg } = await seedConversation(user.id);
    const job = await insertAiJob(db, user.id, {
      conversationId: conv.id,
      userMessageId: msg.id,
      clientRequestId: randomUUID(),
      feature: "chat",
    });

    const [a, b] = await Promise.all([
      claimAiJobs(db, { workerId: "w-a", limit: 1 }),
      claimAiJobs(db, { workerId: "w-b", limit: 1 }),
    ]);

    const claimed = [...a, ...b].filter((j) => j.id === job.id);
    expect(claimed).toHaveLength(1);
    expect(claimed[0].fencingToken).toBe(1);
    expect(claimed[0].attempt).toBe(1);
    expect(claimed[0].status).toBe("running");
    expect(["w-a", "w-b"]).toContain(claimed[0].lockedBy);

    const other = a.length && a[0].id === job.id ? b : a;
    expect(other.every((j) => j.id !== job.id)).toBe(true);
  });

  it("reclaims after lease expiry and increments fencing_token", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const { conv, msg } = await seedConversation(user.id);
    await insertAiJob(db, user.id, {
      conversationId: conv.id,
      userMessageId: msg.id,
      clientRequestId: randomUUID(),
      feature: "chat",
    });

    const [first] = await claimAiJobs(db, {
      workerId: "w-old",
      leaseMs: 60_000,
    });
    expect(first.fencingToken).toBe(1);

    await forceAiJobLeaseExpiry(
      db,
      first.id,
      new Date(Date.now() - 1_000),
    );

    const [second] = await claimAiJobs(db, { workerId: "w-new" });
    expect(second.id).toBe(first.id);
    expect(second.fencingToken).toBe(2);
    expect(second.attempt).toBe(2);
    expect(second.lockedBy).toBe("w-new");

    const staleRenew = await renewAiJobLease(db, {
      jobId: first.id,
      workerId: "w-old",
      fencingToken: first.fencingToken,
    });
    expect(staleRenew).toEqual({ ok: false, reason: "stale_fence" });

    const staleUpdate = await updateAiJobWithFence(
      db,
      {
        jobId: first.id,
        workerId: "w-old",
        fencingToken: first.fencingToken,
      },
      { status: "succeeded", clearLock: true },
    );
    expect(staleUpdate).toEqual({ ok: false, reason: "stale_fence" });

    const stillRunning = await getAiJobById(db, first.id);
    expect(stillRunning?.status).toBe("running");
    expect(stillRunning?.lockedBy).toBe("w-new");
  });

  it("rejects renew/update from a worker with the wrong fencing token", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const { conv, msg } = await seedConversation(user.id);
    await insertAiJob(db, user.id, {
      conversationId: conv.id,
      userMessageId: msg.id,
      clientRequestId: randomUUID(),
      feature: "chat",
    });
    const [claimed] = await claimAiJobs(db, { workerId: "w1" });

    const ok = await renewAiJobLease(db, {
      jobId: claimed.id,
      workerId: "w1",
      fencingToken: claimed.fencingToken,
    });
    expect(ok.ok).toBe(true);

    const bad = await renewAiJobLease(db, {
      jobId: claimed.id,
      workerId: "w1",
      fencingToken: claimed.fencingToken - 1,
    });
    expect(bad.ok).toBe(false);
  });

  it("does not reclaim jobs stuck in calling_provider (uncertain billing)", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const { conv, msg } = await seedConversation(user.id);
    const stuck = await insertAiJob(db, user.id, {
      conversationId: conv.id,
      userMessageId: msg.id,
      clientRequestId: randomUUID(),
      feature: "chat",
      status: "running",
      providerOutcome: "not_started",
      executionPhase: "calling_provider",
      attempt: 1,
      fencingToken: 1,
      lockedBy: "dead",
      leaseExpiresAt: new Date(Date.now() - 5_000),
    });

    const claimed = await claimAiJobs(db, { workerId: "w-x", limit: 10 });
    expect(claimed.find((j) => j.id === stuck.id)).toBeUndefined();
  });

  it("does not reclaim succeeded, canceled, or uncertain jobs", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const { conv, msg } = await seedConversation(user.id);

    const succeeded = await insertAiJob(db, user.id, {
      conversationId: conv.id,
      userMessageId: msg.id,
      clientRequestId: randomUUID(),
      feature: "chat",
      status: "succeeded",
      providerOutcome: "succeeded",
      attempt: 1,
      fencingToken: 1,
    });
    const canceled = await insertAiJob(db, user.id, {
      conversationId: conv.id,
      userMessageId: msg.id,
      clientRequestId: randomUUID(),
      feature: "chat",
      status: "canceled",
      attempt: 1,
      fencingToken: 1,
    });
    const uncertain = await insertAiJob(db, user.id, {
      conversationId: conv.id,
      userMessageId: msg.id,
      clientRequestId: randomUUID(),
      feature: "chat",
      status: "running",
      providerOutcome: "uncertain",
      attempt: 1,
      fencingToken: 1,
      lockedBy: "dead",
      leaseExpiresAt: new Date(Date.now() - 5_000),
    });

    const claimed = await claimAiJobs(db, { workerId: "w-x", limit: 10 });
    const ids = new Set(claimed.map((j) => j.id));
    expect(ids.has(succeeded.id)).toBe(false);
    expect(ids.has(canceled.id)).toBe(false);
    expect(ids.has(uncertain.id)).toBe(false);
  });

  it("enforces unique client_request_id per user", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const { conv, msg } = await seedConversation(user.id);
    const clientRequestId = randomUUID();

    await insertAiJob(db, user.id, {
      conversationId: conv.id,
      userMessageId: msg.id,
      clientRequestId,
      feature: "chat",
    });

    await expect(
      insertAiJob(db, user.id, {
        conversationId: conv.id,
        userMessageId: msg.id,
        clientRequestId,
        feature: "chat",
      }),
    ).rejects.toThrow();
  });

  it("rejects cross-user and cross-conversation message references", async () => {
    const db = getDb();
    const a = newUser("A");
    const b = newUser("B");
    await db.insert(users).values([a, b]);
    const aSeed = await seedConversation(a.id);
    const bSeed = await seedConversation(b.id);

    await expect(
      insertAiJob(db, a.id, {
        conversationId: aSeed.conv.id,
        userMessageId: bSeed.msg.id,
        clientRequestId: randomUUID(),
        feature: "chat",
      }),
    ).rejects.toThrow();

    await expect(
      insertAiJob(db, a.id, {
        conversationId: bSeed.conv.id,
        userMessageId: aSeed.msg.id,
        clientRequestId: randomUUID(),
        feature: "chat",
      }),
    ).rejects.toThrow();

    await expect(
      insertAiJob(db, b.id, {
        conversationId: aSeed.conv.id,
        userMessageId: aSeed.msg.id,
        clientRequestId: randomUUID(),
        feature: "chat",
      }),
    ).rejects.toThrow();
  });

  it("rejects usage_event owned by another user", async () => {
    const db = getDb();
    const a = newUser("A");
    const b = newUser("B");
    await db.insert(users).values([a, b]);
    const aSeed = await seedConversation(a.id);
    const usageB = await insertAiUsageEvent(db, b.id, {
      feature: "chat",
      provider: "mock",
      status: "reserved",
    });

    await expect(
      insertAiJob(db, a.id, {
        conversationId: aSeed.conv.id,
        userMessageId: aSeed.msg.id,
        usageEventId: usageB.id,
        clientRequestId: randomUUID(),
        feature: "chat",
      }),
    ).rejects.toThrow();
  });

  it("applies fenced terminal update only for the owning worker", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const { conv, msg } = await seedConversation(user.id);
    await insertAiJob(db, user.id, {
      conversationId: conv.id,
      userMessageId: msg.id,
      clientRequestId: randomUUID(),
      feature: "chat",
    });
    const [claimed] = await claimAiJobs(db, { workerId: "owner" });

    const done = await updateAiJobWithFence(
      db,
      {
        jobId: claimed.id,
        workerId: "owner",
        fencingToken: claimed.fencingToken,
      },
      {
        status: "succeeded",
        providerOutcome: "succeeded",
        executionPhase: "after_provider",
        finishedAt: new Date(),
        clearLock: true,
      },
    );
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.job.status).toBe("succeeded");
    expect(done.job.lockedBy).toBeNull();

    const again = await claimAiJobs(db, { workerId: "other", limit: 5 });
    expect(again.find((j) => j.id === claimed.id)).toBeUndefined();
  });
});
