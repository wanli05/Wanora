import { and, eq, lt, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { aiJobs } from "@/db/schema";
import {
  type AiJobRow,
  type AiJobFence,
} from "@/lib/data/ai-jobs";
import { DEFAULT_AI_WORKER_LEASE_MS } from "@/lib/ai/jobs/timing";

/**
 * Test-harness claim for a single job id.
 *
 * Same runnable predicates + fence/lease semantics as `claimAiJobs`, but does
 * **not** scan the global queue — so it cannot steal or cancel unrelated jobs.
 * Do not use this from the production worker.
 */
export async function claimAiJobByIdForTest(
  db: Db,
  input: {
    jobId: string;
    workerId: string;
    leaseMs?: number;
    now?: Date;
  },
): Promise<AiJobRow | null> {
  const workerId = input.workerId.trim();
  if (!workerId) {
    throw new Error("workerId is required");
  }
  const jobId = input.jobId.trim();
  if (!jobId) {
    throw new Error("jobId is required");
  }

  const leaseMs = input.leaseMs ?? DEFAULT_AI_WORKER_LEASE_MS;
  const now = input.now ?? new Date();
  const leaseExpires = new Date(now.getTime() + leaseMs);

  return db.transaction(async (tx) => {
    const candidates = await tx
      .select({ id: aiJobs.id })
      .from(aiJobs)
      .where(
        and(
          eq(aiJobs.id, jobId),
          or(
            eq(aiJobs.status, "queued"),
            and(
              eq(aiJobs.status, "running"),
              lt(aiJobs.leaseExpiresAt, now),
              eq(aiJobs.providerOutcome, "not_started"),
              eq(aiJobs.executionPhase, "before_provider"),
              sql`${aiJobs.attempt} < ${aiJobs.maxAttempts}`,
            ),
          ),
        ),
      )
      .limit(1)
      .for("update", { skipLocked: true });

    if (candidates.length === 0) return null;

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
      .where(eq(aiJobs.id, jobId))
      .returning();

    return row ?? null;
  });
}

export function fenceOfClaimedJob(
  job: AiJobRow,
  workerId: string,
): AiJobFence {
  return {
    jobId: job.id,
    workerId,
    fencingToken: job.fencingToken,
  };
}
