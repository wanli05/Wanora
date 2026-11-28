import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { aiJobs, aiUsageEvents } from "@/db/schema";
import type { AiJobRow } from "@/lib/data/ai-jobs";
import type { AiUsageEventRow } from "@/lib/data/ai-usage";
import {
  displayAiUsageCost,
  findAiUsageByRequestIdAnyUser,
  serializeAiUsageMeta,
} from "@/lib/ai/usage";

/**
 * Product invariant (enqueue + worker):
 * - One clientRequestId → at most one ai_jobs row (UNIQUE) → one usage reservation.
 * - `attempt` increments on every Worker *claim* (including before_provider reclaim).
 * - Auto-retry only when executionPhase=before_provider and providerOutcome=not_started
 *   → those claims never call the Provider.
 * - Once executionPhase reaches calling_provider, reclaim marks uncertain and
 *   never auto-retries → at most one Provider call per clientRequestId.
 */

export type InferredProviderCall = {
  /** 1-based index within this request (always 1 when present — product max). */
  index: number;
  status:
    | "succeeded"
    | "failed_with_tokens"
    | "failed_clean"
    | "uncertain_tokens_unknown"
    | "entered_unsettled";
  provider: string | null;
  model: string | null;
  providerResponseId: string | null;
  usageEventId: string | null;
  jobErrorCode: string | null;
  /** Settled tokens only; unknown / still reserved → null. */
  inputTokens: number | null;
  outputTokens: number | null;
  costDisplay: ReturnType<typeof displayAiUsageCost> | null;
};

export type ProviderCallInference = {
  /** `ai_jobs.attempt` — Worker claim / reclaim count. Not Provider calls. */
  workerClaimAttempts: number;
  /**
   * Inferred Provider invocations for this request (0 or 1 under current rules).
   * Derived from executionPhase / providerOutcome — not from attempt.
   */
  providerCallsInferred: number;
  providerCalls: InferredProviderCall[];
  notes: string[];
};

const INVARIANT_NOTES = [
  "workerClaimAttempts (ai_jobs.attempt) counts Worker claims/reclaims, not Provider HTTP calls.",
  "Auto-retry is allowed only before_provider + not_started; those retries do not call the Provider.",
  "After calling_provider, reclaim marks uncertain and never auto-retries → at most one Provider call per clientRequestId.",
] as const;

export function jobEnteredProvider(
  job: Pick<AiJobRow, "executionPhase" | "providerOutcome">,
): boolean {
  return (
    job.executionPhase === "calling_provider" ||
    job.executionPhase === "after_provider" ||
    job.providerOutcome !== "not_started"
  );
}

export function inferProviderCallsFromJob(
  job: Pick<
    AiJobRow,
    | "attempt"
    | "executionPhase"
    | "providerOutcome"
    | "errorCode"
    | "provider"
    | "model"
    | "usageEventId"
  >,
  usage: AiUsageEventRow | null,
): ProviderCallInference {
  const notes: string[] = [...INVARIANT_NOTES];

  if (!jobEnteredProvider(job)) {
    notes.push(
      "Provider was not entered for this request (still before calling_provider).",
    );
    return {
      workerClaimAttempts: job.attempt,
      providerCallsInferred: 0,
      providerCalls: [],
      notes,
    };
  }

  const cost = usage ? displayAiUsageCost(usage) : null;
  const settled =
    usage &&
    (usage.status === "ok" || usage.status === "invalid_output");
  const hasSettledTokens = Boolean(
    settled && usage && usage.inputTokens + usage.outputTokens > 0,
  );

  let status: InferredProviderCall["status"];
  if (
    job.errorCode === "usage_unknown" ||
    job.providerOutcome === "uncertain" ||
    cost?.kind === "unknown"
  ) {
    status = "uncertain_tokens_unknown";
    notes.push(
      "A Provider call was started but tokens/cost are unknown — reserved budget is held (not treated as $0).",
    );
  } else if (job.providerOutcome === "succeeded" || usage?.status === "ok") {
    status = "succeeded";
  } else if (hasSettledTokens) {
    // e.g. invalid_output with usage — call happened and was billed.
    status = "failed_with_tokens";
  } else if (job.providerOutcome === "failed") {
    status = "failed_clean";
  } else {
    status = "entered_unsettled";
  }

  const call: InferredProviderCall = {
    index: 1,
    status,
    provider: job.provider ?? usage?.provider ?? null,
    model: job.model ?? usage?.model ?? null,
    providerResponseId: usage?.providerResponseId ?? null,
    usageEventId: job.usageEventId ?? usage?.id ?? null,
    jobErrorCode: job.errorCode,
    inputTokens: settled && usage ? usage.inputTokens : null,
    outputTokens: settled && usage ? usage.outputTokens : null,
    costDisplay: cost,
  };

  return {
    workerClaimAttempts: job.attempt,
    providerCallsInferred: 1,
    providerCalls: [call],
    notes,
  };
}

export type AiRequestInspectResult = {
  clientRequestId: string;
  found: boolean;
  /**
   * Day-summary field `callsWithTokens` counts usage rows with token sums > 0.
   * It is NOT the same as providerCallsInferred (see inference.notes).
   */
  job: {
    id: string;
    userId: string;
    feature: string;
    status: string;
    attempt: number;
    maxAttempts: number;
    executionPhase: string;
    providerOutcome: string;
    errorCode: string | null;
    provider: string | null;
    model: string | null;
    usageEventId: string | null;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
  } | null;
  usage: ReturnType<typeof serializeAiUsageMeta> | null;
  inference: ProviderCallInference;
};

async function findAiJobByClientRequestIdAnyUser(
  db: Db,
  clientRequestId: string,
) {
  const [row] = await db
    .select()
    .from(aiJobs)
    .where(eq(aiJobs.clientRequestId, clientRequestId))
    .orderBy(desc(aiJobs.createdAt))
    .limit(1);
  return row ?? null;
}

/**
 * Ops / CLI: resolve one 添削 (or chat) clientRequestId to job + usage +
 * inferred Provider calls. Metadata only.
 */
export async function inspectAiRequestByClientRequestId(
  db: Db,
  clientRequestId: string,
): Promise<AiRequestInspectResult> {
  const job = await findAiJobByClientRequestIdAnyUser(db, clientRequestId);
  let usage = await findAiUsageByRequestIdAnyUser(db, clientRequestId);

  if (job?.usageEventId) {
    const [linked] = await db
      .select()
      .from(aiUsageEvents)
      .where(
        and(
          eq(aiUsageEvents.id, job.usageEventId),
          eq(aiUsageEvents.userId, job.userId),
        ),
      )
      .limit(1);
    if (linked) usage = linked;
  }

  if (!job && !usage) {
    return {
      clientRequestId,
      found: false,
      job: null,
      usage: null,
      inference: {
        workerClaimAttempts: 0,
        providerCallsInferred: 0,
        providerCalls: [],
        notes: [
          "No ai_jobs / ai_usage_events row for this clientRequestId.",
          "Typical for enqueue budget/rate reject (no job created) → Provider calls = 0.",
          "workerClaimAttempts is 0; providerCallsInferred is 0.",
          "callsWithTokens in day summary would also be 0 for this id (no usage row).",
        ],
      },
    };
  }

  if (!job) {
    const cost = usage ? displayAiUsageCost(usage) : null;
    return {
      clientRequestId,
      found: true,
      job: null,
      usage: usage ? serializeAiUsageMeta(usage) : null,
      inference: {
        workerClaimAttempts: 0,
        providerCallsInferred: 0,
        providerCalls: [],
        notes: [
          "Usage event exists without a job (e.g. sync guard reject).",
          `usage.status=${usage?.status ?? "n/a"} costDisplay=${cost?.kind ?? "n/a"}`,
          "Provider was never called.",
        ],
      },
    };
  }

  return {
    clientRequestId,
    found: true,
    job: {
      id: job.id,
      userId: job.userId,
      feature: job.feature,
      status: job.status,
      attempt: job.attempt,
      maxAttempts: job.maxAttempts,
      executionPhase: job.executionPhase,
      providerOutcome: job.providerOutcome,
      errorCode: job.errorCode,
      provider: job.provider,
      model: job.model,
      usageEventId: job.usageEventId,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString() ?? null,
      finishedAt: job.finishedAt?.toISOString() ?? null,
    },
    usage: usage ? serializeAiUsageMeta(usage) : null,
    inference: inferProviderCallsFromJob(job, usage),
  };
}
