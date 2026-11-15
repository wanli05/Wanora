import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { aiJobs, type AiJobStatus } from "@/db/schema";
import { withUserAiLock } from "@/lib/ai/rate-limit";
import { softDeleteAiConversation } from "@/lib/data/ai-conversations";
import {
  getAiJob,
  type AiJobRow,
} from "@/lib/data/ai-jobs";
import { releaseReservedUsageIfNeeded } from "@/lib/ai/jobs/release-budget";

const TERMINAL: AiJobStatus[] = ["succeeded", "failed", "canceled"];

export type CancelAiJobResult =
  | { ok: true; job: AiJobRow; alreadyTerminal: boolean }
  | { ok: false; code: "not_found" };

/**
 * Cancel a job owned by `userId`.
 * - queued → canceled + release reserved (atomic)
 * - running → set cancel_requested_at (Worker honors by phase)
 * - terminal → idempotent replay
 */
export async function cancelAiJob(
  db: Db,
  userId: string,
  jobId: string,
  now = new Date(),
): Promise<CancelAiJobResult> {
  const existing = await getAiJob(db, userId, jobId);
  if (!existing) return { ok: false, code: "not_found" };

  if (TERMINAL.includes(existing.status as AiJobStatus)) {
    return { ok: true, job: existing, alreadyTerminal: true };
  }

  return db.transaction(async (tx) => {
    return withUserAiLock(tx, userId, async () => {
      const [job] = await tx
        .select()
        .from(aiJobs)
        .where(and(eq(aiJobs.id, jobId), eq(aiJobs.userId, userId)))
        .limit(1)
        .for("update");

      if (!job) return { ok: false as const, code: "not_found" as const };

      if (TERMINAL.includes(job.status as AiJobStatus)) {
        return { ok: true as const, job, alreadyTerminal: true };
      }

      if (job.status === "queued") {
        await releaseReservedUsageIfNeeded(tx, {
          userId,
          usageEventId: job.usageEventId,
          errorCode: "canceled",
          now,
        });
        const [updated] = await tx
          .update(aiJobs)
          .set({
            status: "canceled",
            cancelRequestedAt: job.cancelRequestedAt ?? now,
            errorCode: job.errorCode ?? "canceled",
            errorMessage: job.errorMessage ?? "canceled by user",
            finishedAt: now,
            lockedBy: null,
            leaseExpiresAt: null,
            executionPhase: "queued",
          })
          .where(
            and(
              eq(aiJobs.id, jobId),
              eq(aiJobs.userId, userId),
              eq(aiJobs.status, "queued"),
            ),
          )
          .returning();
        if (!updated) {
          // Lost race to claim — fall through to request-cancel path.
          const [again] = await tx
            .select()
            .from(aiJobs)
            .where(and(eq(aiJobs.id, jobId), eq(aiJobs.userId, userId)))
            .limit(1);
          if (again && TERMINAL.includes(again.status as AiJobStatus)) {
            return { ok: true as const, job: again, alreadyTerminal: true };
          }
          if (again?.status === "running") {
            return requestCancelRunning(tx, again, now);
          }
          return {
            ok: false as const,
            code: "not_found" as const,
          };
        }
        return { ok: true as const, job: updated, alreadyTerminal: false };
      }

      // running
      return requestCancelRunning(tx, job, now);
    });
  });
}

async function requestCancelRunning(
  db: Db,
  job: AiJobRow,
  now: Date,
): Promise<{ ok: true; job: AiJobRow; alreadyTerminal: boolean }> {
  if (job.cancelRequestedAt) {
    return { ok: true, job, alreadyTerminal: false };
  }
  const [updated] = await db
    .update(aiJobs)
    .set({ cancelRequestedAt: now })
    .where(
      and(
        eq(aiJobs.id, job.id),
        eq(aiJobs.userId, job.userId),
        eq(aiJobs.status, "running"),
      ),
    )
    .returning();
  return {
    ok: true,
    job: updated ?? job,
    alreadyTerminal: false,
  };
}

/**
 * Soft-delete conversation and cancel unfinished jobs in one transaction.
 * queued → canceled + budget release; running → cancel_requested_at.
 */
export async function softDeleteConversationAndCancelJobs(
  db: Db,
  userId: string,
  conversationId: string,
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    return withUserAiLock(tx, userId, async () => {
      const conv = await softDeleteAiConversation(tx, userId, conversationId);
      if (!conv) return null;

      const open = await tx
        .select()
        .from(aiJobs)
        .where(
          and(
            eq(aiJobs.userId, userId),
            eq(aiJobs.conversationId, conversationId),
            inArray(aiJobs.status, ["queued", "running"]),
          ),
        )
        .for("update");

      for (const job of open) {
        if (job.status === "queued") {
          await releaseReservedUsageIfNeeded(tx, {
            userId,
            usageEventId: job.usageEventId,
            errorCode: "conversation_deleted",
            now,
          });
          await tx
            .update(aiJobs)
            .set({
              status: "canceled",
              cancelRequestedAt: job.cancelRequestedAt ?? now,
              errorCode: "conversation_deleted",
              errorMessage: "conversation soft-deleted",
              finishedAt: now,
              lockedBy: null,
              leaseExpiresAt: null,
            })
            .where(eq(aiJobs.id, job.id));
        } else if (!job.cancelRequestedAt) {
          await tx
            .update(aiJobs)
            .set({ cancelRequestedAt: now })
            .where(and(eq(aiJobs.id, job.id), eq(aiJobs.status, "running")));
        }
      }

      return conv;
    });
  });
}

/** Cancel all queued jobs for a conversation (used by purge prep). */
export async function cancelOpenJobsForConversations(
  db: Db,
  conversationIds: string[],
  now = new Date(),
) {
  if (conversationIds.length === 0) return { canceled: 0, requested: 0 };
  let canceled = 0;
  let requested = 0;

  const open = await db
    .select()
    .from(aiJobs)
    .where(
      and(
        inArray(aiJobs.conversationId, conversationIds),
        or(eq(aiJobs.status, "queued"), eq(aiJobs.status, "running")),
      ),
    );

  for (const job of open) {
    await db.transaction(async (tx) => {
      await withUserAiLock(tx, job.userId, async () => {
        if (job.status === "queued") {
          await releaseReservedUsageIfNeeded(tx, {
            userId: job.userId,
            usageEventId: job.usageEventId,
            errorCode: "purged",
            now,
          });
          const [u] = await tx
            .update(aiJobs)
            .set({
              status: "canceled",
              cancelRequestedAt: now,
              errorCode: "purged",
              finishedAt: now,
              lockedBy: null,
              leaseExpiresAt: null,
            })
            .where(and(eq(aiJobs.id, job.id), eq(aiJobs.status, "queued")))
            .returning();
          if (u) canceled += 1;
        } else {
          const [u] = await tx
            .update(aiJobs)
            .set({ cancelRequestedAt: sql`coalesce(${aiJobs.cancelRequestedAt}, ${now})` })
            .where(and(eq(aiJobs.id, job.id), eq(aiJobs.status, "running")))
            .returning();
          if (u) requested += 1;
        }
      });
    });
  }

  return { canceled, requested };
}
