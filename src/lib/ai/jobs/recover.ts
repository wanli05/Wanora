import { and, asc, eq, lt, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { aiJobs } from "@/db/schema";
import { getServerEnv } from "@/lib/env";
import { withUserAiLock } from "@/lib/ai/rate-limit";
import { releaseReservedUsageIfNeeded } from "@/lib/ai/jobs/release-budget";

export type RecoverLeaseResult = {
  /** Expired before_provider jobs left for normal claim/retry. */
  requeueEligible: number;
  /** Stuck calling/after_provider → failed + uncertain (no auto provider retry). */
  markedUncertain: number;
};

/**
 * Detect expired leases and classify recovery:
 * - before_provider + not_started: leave for claimAiJobs (auto-retry OK)
 * - calling_provider / after_provider: mark uncertain via SKIP LOCKED (no provider retry)
 *
 * Concurrent-safe: FOR UPDATE SKIP LOCKED; only one recoverer mutates each row.
 * Does not settle budgets for uncertain (reconcileUncertainBudgets does that later).
 */
export async function recoverExpiredAiJobLeases(
  db: Db,
  options?: { now?: Date; limit?: number },
): Promise<RecoverLeaseResult> {
  const now = options?.now ?? new Date();
  const limit = options?.limit ?? 50;

  const requeueEligible = await db
    .select({ id: aiJobs.id })
    .from(aiJobs)
    .where(
      and(
        eq(aiJobs.status, "running"),
        lt(aiJobs.leaseExpiresAt, now),
        eq(aiJobs.providerOutcome, "not_started"),
        eq(aiJobs.executionPhase, "before_provider"),
        sql`${aiJobs.attempt} < ${aiJobs.maxAttempts}`,
      ),
    )
    .limit(limit);

  const markedUncertain = await db.transaction(async (tx) => {
    const stuck = await tx
      .select()
      .from(aiJobs)
      .where(
        and(
          eq(aiJobs.status, "running"),
          lt(aiJobs.leaseExpiresAt, now),
          or(
            eq(aiJobs.executionPhase, "calling_provider"),
            eq(aiJobs.executionPhase, "after_provider"),
          ),
        ),
      )
      .orderBy(asc(aiJobs.createdAt))
      .limit(limit)
      .for("update", { skipLocked: true });

    let n = 0;
    for (const job of stuck) {
      const [updated] = await tx
        .update(aiJobs)
        .set({
          status: "failed",
          providerOutcome: "uncertain",
          executionPhase: "after_provider",
          errorCode: "provider_uncertain",
          errorMessage: "lease expired during/after provider call",
          finishedAt: now,
          lockedBy: null,
          leaseExpiresAt: null,
        })
        .where(
          and(
            eq(aiJobs.id, job.id),
            eq(aiJobs.status, "running"),
            lt(aiJobs.leaseExpiresAt, now),
          ),
        )
        .returning();
      if (updated) n += 1;
    }
    return n;
  });

  return {
    requeueEligible: requeueEligible.length,
    markedUncertain,
  };
}

/**
 * Release reserved budgets for failed+uncertain jobs older than the reconcile window.
 * Concurrent-safe via SKIP LOCKED + per-user advisory lock; skips already-settled usage.
 */
export async function reconcileUncertainBudgets(
  db: Db,
  options?: { now?: Date; limit?: number; olderThanMs?: number },
): Promise<{ reconciled: number }> {
  const env = getServerEnv();
  const now = options?.now ?? new Date();
  const olderThanMs =
    options?.olderThanMs ?? env.AI_UNCERTAIN_RECONCILE_AFTER_HOURS * 3_600_000;
  const cutoff = new Date(now.getTime() - olderThanMs);
  const limit = options?.limit ?? 50;

  let reconciled = 0;
  await db.transaction(async (tx) => {
    const candidates = await tx
      .select()
      .from(aiJobs)
      .where(
        and(
          eq(aiJobs.status, "failed"),
          eq(aiJobs.providerOutcome, "uncertain"),
          lt(aiJobs.finishedAt, cutoff),
        ),
      )
      .orderBy(asc(aiJobs.finishedAt))
      .limit(limit)
      .for("update", { skipLocked: true });

    for (const job of candidates) {
      await withUserAiLock(tx, job.userId, async () => {
        const { released } = await releaseReservedUsageIfNeeded(tx, {
          userId: job.userId,
          usageEventId: job.usageEventId,
          errorCode: "uncertain_reconciled",
          now,
        });
        await tx
          .update(aiJobs)
          .set({
            errorMessage:
              job.errorMessage ??
              (released
                ? "uncertain reservation released after reconcile window"
                : "uncertain already settled"),
          })
          .where(eq(aiJobs.id, job.id));
        if (released) reconciled += 1;
      });
    }
  });

  return { reconciled };
}

/** Exhausted before_provider attempts → permanent fail + release (clean, no provider). */
export async function failExhaustedBeforeProviderJobs(
  db: Db,
  options?: { now?: Date; limit?: number },
): Promise<{ failed: number }> {
  const now = options?.now ?? new Date();
  const limit = options?.limit ?? 50;

  let failed = 0;
  await db.transaction(async (tx) => {
    const stuck = await tx
      .select()
      .from(aiJobs)
      .where(
        and(
          eq(aiJobs.status, "running"),
          lt(aiJobs.leaseExpiresAt, now),
          eq(aiJobs.providerOutcome, "not_started"),
          eq(aiJobs.executionPhase, "before_provider"),
          sql`${aiJobs.attempt} >= ${aiJobs.maxAttempts}`,
        ),
      )
      .limit(limit)
      .for("update", { skipLocked: true });

    for (const job of stuck) {
      await withUserAiLock(tx, job.userId, async () => {
        await releaseReservedUsageIfNeeded(tx, {
          userId: job.userId,
          usageEventId: job.usageEventId,
          errorCode: "max_attempts",
          now,
        });
        const [u] = await tx
          .update(aiJobs)
          .set({
            status: "failed",
            providerOutcome: "failed",
            errorCode: "max_attempts",
            errorMessage: "exceeded max attempts before provider",
            finishedAt: now,
            lockedBy: null,
            leaseExpiresAt: null,
            executionPhase: "after_provider",
          })
          .where(and(eq(aiJobs.id, job.id), eq(aiJobs.status, "running")))
          .returning();
        if (u) failed += 1;
      });
    }
  });
  return { failed };
}

/** One maintenance tick used by worker / admin purge. */
export async function runAiJobMaintenance(
  db: Db,
  options?: { now?: Date },
) {
  const now = options?.now ?? new Date();
  const exhausted = await failExhaustedBeforeProviderJobs(db, { now });
  const recovered = await recoverExpiredAiJobLeases(db, { now });
  const reconciled = await reconcileUncertainBudgets(db, { now });
  return { ...exhausted, ...recovered, ...reconciled };
}
