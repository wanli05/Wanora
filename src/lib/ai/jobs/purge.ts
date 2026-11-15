import { and, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { aiConversations, aiJobs, aiMessages, users } from "@/db/schema";
import { getServerEnv } from "@/lib/env";
import { withUserAiLock } from "@/lib/ai/rate-limit";
import { releaseReservedUsageIfNeeded } from "@/lib/ai/jobs/release-budget";
import { runAiJobMaintenance } from "@/lib/ai/jobs/recover";

export type PurgeDeletedResult = {
  conversations: number;
  jobs: number;
  messages: number;
  maintenance: Awaited<ReturnType<typeof runAiJobMaintenance>>;
};

/**
 * Hard-delete soft-deleted conversations older than the retention window.
 *
 * Order (RESTRICT-safe):
 * 1. maintenance (uncertain reconcile / stuck leases)
 * 2. settle+cancel any still-open jobs on those conversations
 * 3. DELETE ai_jobs for those conversations
 * 4. DELETE ai_conversations (messages CASCADE)
 *
 * Usage rows are retained (conversation_id SET NULL via existing FK).
 */
export async function purgeDeletedAiConversations(
  db: Db,
  options?: { now?: Date; olderThanDays?: number },
): Promise<PurgeDeletedResult> {
  const env = getServerEnv();
  const now = options?.now ?? new Date();
  const days = options?.olderThanDays ?? env.AI_CHAT_HARD_DELETE_AFTER_DAYS;
  const cutoff = new Date(now.getTime() - days * 86_400_000);

  const maintenance = await runAiJobMaintenance(db, { now });

  const expired = await db
    .select({ id: aiConversations.id, userId: aiConversations.userId })
    .from(aiConversations)
    .where(
      and(
        eq(aiConversations.status, "deleted"),
        isNotNull(aiConversations.deletedAt),
        lt(aiConversations.deletedAt, cutoff),
      ),
    );

  if (expired.length === 0) {
    return { conversations: 0, jobs: 0, messages: 0, maintenance };
  }

  const ids = expired.map((c) => c.id);

  // Settle reserved usage on any leftover open/uncertain jobs before deleting jobs.
  const relatedJobs = await db
    .select()
    .from(aiJobs)
    .where(inArray(aiJobs.conversationId, ids));

  for (const job of relatedJobs) {
    if (
      job.status === "queued" ||
      job.status === "running" ||
      (job.status === "failed" && job.providerOutcome === "uncertain")
    ) {
      await db.transaction(async (tx) => {
        await withUserAiLock(tx, job.userId, async () => {
          await releaseReservedUsageIfNeeded(tx, {
            userId: job.userId,
            usageEventId: job.usageEventId,
            errorCode:
              job.providerOutcome === "uncertain"
                ? "uncertain_reconciled"
                : "purged",
            now,
          });
          if (job.status === "queued" || job.status === "running") {
            await tx
              .update(aiJobs)
              .set({
                status: "canceled",
                cancelRequestedAt: job.cancelRequestedAt ?? now,
                errorCode: "purged",
                finishedAt: now,
                lockedBy: null,
                leaseExpiresAt: null,
              })
              .where(
                and(
                  eq(aiJobs.id, job.id),
                  inArray(aiJobs.status, ["queued", "running"]),
                ),
              );
          }
        });
      });
    }
  }

  const msgCount = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(aiMessages)
    .where(inArray(aiMessages.conversationId, ids));

  const deletedJobs = await db
    .delete(aiJobs)
    .where(inArray(aiJobs.conversationId, ids))
    .returning({ id: aiJobs.id });

  const deletedConvs = await db
    .delete(aiConversations)
    .where(inArray(aiConversations.id, ids))
    .returning({ id: aiConversations.id });

  return {
    conversations: deletedConvs.length,
    jobs: deletedJobs.length,
    messages: Number(msgCount[0]?.n ?? 0),
    maintenance,
  };
}

/**
 * Delete AI jobs for a user before account hard-delete so Message/Usage
 * RESTRICT FKs cannot block `DELETE FROM users` CASCADE ordering.
 */
export async function deleteAiJobsForUser(db: Db, userId: string, now = new Date()) {
  const jobs = await db.select().from(aiJobs).where(eq(aiJobs.userId, userId));
  for (const job of jobs) {
    await db.transaction(async (tx) => {
      await withUserAiLock(tx, userId, async () => {
        await releaseReservedUsageIfNeeded(tx, {
          userId,
          usageEventId: job.usageEventId,
          errorCode: "account_deleted",
          now,
        });
      });
    });
  }
  const deleted = await db
    .delete(aiJobs)
    .where(eq(aiJobs.userId, userId))
    .returning({ id: aiJobs.id });
  return { deletedJobs: deleted.length };
}

/**
 * Full account AI cleanup then delete the user row (CASCADE cleans the rest).
 * Prefer this over bare `DELETE FROM users` when jobs may reference messages.
 */
export async function hardDeleteUserAccount(db: Db, userId: string) {
  await deleteAiJobsForUser(db, userId);
  await db.delete(users).where(eq(users.id, userId));
}
