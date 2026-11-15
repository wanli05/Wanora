import { and, asc, eq, lt, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import {
  aiJobs,
  type AiJobExecutionPhase,
  type AiJobProviderOutcome,
  type AiJobStatus,
} from "@/db/schema";

export type AiJobRow = typeof aiJobs.$inferSelect;

export type InsertAiJobInput = {
  conversationId: string;
  clientRequestId: string;
  feature: string;
  userMessageId?: string | null;
  resultMessageId?: string | null;
  usageEventId?: string | null;
  status?: AiJobStatus;
  attempt?: number;
  maxAttempts?: number;
  lockedBy?: string | null;
  leaseExpiresAt?: Date | null;
  fencingToken?: number;
  executionPhase?: AiJobExecutionPhase;
  cancelRequestedAt?: Date | null;
  providerOutcome?: AiJobProviderOutcome;
  errorCode?: string | null;
  errorMessage?: string | null;
  pageContext?: unknown;
  targetContext?: unknown;
  resultPayload?: unknown;
  provider?: string | null;
  model?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
};

export type AiJobFence = {
  jobId: string;
  workerId: string;
  fencingToken: number;
};

export type FenceWriteResult =
  | { ok: true; job: AiJobRow }
  | { ok: false; reason: "stale_fence" };

const DEFAULT_LEASE_MS = 30_000;

/** Insert a job row (tests / future enqueue). Does not claim. */
export async function insertAiJob(
  db: Db,
  userId: string,
  input: InsertAiJobInput,
) {
  const [row] = await db
    .insert(aiJobs)
    .values({
      userId,
      conversationId: input.conversationId,
      clientRequestId: input.clientRequestId,
      feature: input.feature,
      userMessageId: input.userMessageId ?? null,
      resultMessageId: input.resultMessageId ?? null,
      usageEventId: input.usageEventId ?? null,
      status: input.status ?? "queued",
      attempt: input.attempt ?? 0,
      maxAttempts: input.maxAttempts ?? 3,
      lockedBy: input.lockedBy ?? null,
      leaseExpiresAt: input.leaseExpiresAt ?? null,
      fencingToken: input.fencingToken ?? 0,
      executionPhase: input.executionPhase ?? "queued",
      cancelRequestedAt: input.cancelRequestedAt ?? null,
      providerOutcome: input.providerOutcome ?? "not_started",
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
      pageContext: input.pageContext ?? null,
      targetContext: input.targetContext ?? null,
      resultPayload: input.resultPayload ?? null,
      provider: input.provider ?? null,
      model: input.model ?? null,
      startedAt: input.startedAt ?? null,
      finishedAt: input.finishedAt ?? null,
    })
    .returning();
  return row;
}

export async function getAiJob(db: Db, userId: string, id: string) {
  const [row] = await db
    .select()
    .from(aiJobs)
    .where(and(eq(aiJobs.id, id), eq(aiJobs.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function getAiJobById(db: Db, id: string) {
  const [row] = await db.select().from(aiJobs).where(eq(aiJobs.id, id)).limit(1);
  return row ?? null;
}

/**
 * Atomically claim up to `limit` runnable jobs via FOR UPDATE SKIP LOCKED.
 * Increments fencing_token and attempt on each claim.
 *
 * Runnable:
 * - status=queued, or
 * - status=running AND lease expired AND provider_outcome=not_started
 *   AND attempt < max_attempts
 *
 * Never auto-claims succeeded/failed/canceled or provider_outcome=uncertain.
 */
export async function claimAiJobs(
  db: Db,
  input: {
    workerId: string;
    limit?: number;
    leaseMs?: number;
    now?: Date;
  },
): Promise<AiJobRow[]> {
  const workerId = input.workerId;
  const limit = input.limit ?? 1;
  const leaseMs = input.leaseMs ?? DEFAULT_LEASE_MS;
  const now = input.now ?? new Date();
  const leaseExpires = new Date(now.getTime() + leaseMs);

  return db.transaction(async (tx) => {
    const candidates = await tx
      .select({ id: aiJobs.id })
      .from(aiJobs)
      .where(
        or(
          eq(aiJobs.status, "queued"),
          and(
            eq(aiJobs.status, "running"),
            lt(aiJobs.leaseExpiresAt, now),
            eq(aiJobs.providerOutcome, "not_started"),
            sql`${aiJobs.attempt} < ${aiJobs.maxAttempts}`,
          ),
        ),
      )
      .orderBy(asc(aiJobs.createdAt))
      .limit(limit)
      .for("update", { skipLocked: true });

    if (candidates.length === 0) return [];

    const claimed: AiJobRow[] = [];
    for (const { id } of candidates) {
      const [row] = await tx
        .update(aiJobs)
        .set({
          status: "running",
          lockedBy: workerId,
          leaseExpiresAt: leaseExpires,
          fencingToken: sql`${aiJobs.fencingToken} + 1`,
          attempt: sql`${aiJobs.attempt} + 1`,
          executionPhase: "before_provider",
          startedAt: sql`coalesce(${aiJobs.startedAt}, ${now})`,
        })
        .where(eq(aiJobs.id, id))
        .returning();
      if (row) claimed.push(row);
    }
    return claimed;
  });
}

/**
 * Renew lease while holding a valid fencing token.
 * Returns stale_fence when the worker no longer owns the job.
 */
export async function renewAiJobLease(
  db: Db,
  fence: AiJobFence,
  options?: { leaseMs?: number; now?: Date },
): Promise<FenceWriteResult> {
  const now = options?.now ?? new Date();
  const leaseMs = options?.leaseMs ?? DEFAULT_LEASE_MS;
  const leaseExpires = new Date(now.getTime() + leaseMs);

  const [row] = await db
    .update(aiJobs)
    .set({ leaseExpiresAt: leaseExpires })
    .where(
      and(
        eq(aiJobs.id, fence.jobId),
        eq(aiJobs.lockedBy, fence.workerId),
        eq(aiJobs.fencingToken, fence.fencingToken),
        eq(aiJobs.status, "running"),
      ),
    )
    .returning();

  if (!row) return { ok: false, reason: "stale_fence" };
  return { ok: true, job: row };
}

export type AiJobFencedPatch = {
  status?: AiJobStatus;
  executionPhase?: AiJobExecutionPhase;
  providerOutcome?: AiJobProviderOutcome;
  errorCode?: string | null;
  errorMessage?: string | null;
  resultPayload?: unknown;
  resultMessageId?: string | null;
  usageEventId?: string | null;
  provider?: string | null;
  model?: string | null;
  finishedAt?: Date | null;
  cancelRequestedAt?: Date | null;
  /** Clear lock fields when entering a terminal or re-queued state. */
  clearLock?: boolean;
};

/**
 * Fenced mutation for status / payload updates (and future settle companions).
 * Call inside the same DB transaction as any budget side effects.
 */
export async function updateAiJobWithFence(
  db: Db,
  fence: AiJobFence,
  patch: AiJobFencedPatch,
): Promise<FenceWriteResult> {
  const [row] = await db
    .update(aiJobs)
    .set({
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.executionPhase !== undefined
        ? { executionPhase: patch.executionPhase }
        : {}),
      ...(patch.providerOutcome !== undefined
        ? { providerOutcome: patch.providerOutcome }
        : {}),
      ...(patch.errorCode !== undefined ? { errorCode: patch.errorCode } : {}),
      ...(patch.errorMessage !== undefined
        ? { errorMessage: patch.errorMessage }
        : {}),
      ...(patch.resultPayload !== undefined
        ? { resultPayload: patch.resultPayload }
        : {}),
      ...(patch.resultMessageId !== undefined
        ? { resultMessageId: patch.resultMessageId }
        : {}),
      ...(patch.usageEventId !== undefined
        ? { usageEventId: patch.usageEventId }
        : {}),
      ...(patch.provider !== undefined ? { provider: patch.provider } : {}),
      ...(patch.model !== undefined ? { model: patch.model } : {}),
      ...(patch.finishedAt !== undefined ? { finishedAt: patch.finishedAt } : {}),
      ...(patch.cancelRequestedAt !== undefined
        ? { cancelRequestedAt: patch.cancelRequestedAt }
        : {}),
      ...(patch.clearLock ? { lockedBy: null, leaseExpiresAt: null } : {}),
    })
    .where(
      and(
        eq(aiJobs.id, fence.jobId),
        eq(aiJobs.lockedBy, fence.workerId),
        eq(aiJobs.fencingToken, fence.fencingToken),
        eq(aiJobs.status, "running"),
      ),
    )
    .returning();

  if (!row) return { ok: false, reason: "stale_fence" };
  return { ok: true, job: row };
}

/** Test helper: force lease expiry without going through claim. */
export async function forceAiJobLeaseExpiry(
  db: Db,
  jobId: string,
  expiredAt: Date,
) {
  const [row] = await db
    .update(aiJobs)
    .set({ leaseExpiresAt: expiredAt })
    .where(eq(aiJobs.id, jobId))
    .returning();
  return row ?? null;
}
