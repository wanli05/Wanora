import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { aiUsageEvents } from "@/db/schema";
import { settleBudgets } from "@/lib/ai/budget";
import { resolveAiContext } from "@/lib/ai/context/resolve";
import type { AiPageContext, AiTargetContext } from "@/lib/ai/context/types";
import { getAiProvider } from "@/lib/ai/provider";
import { buildSettledUsageFromCompletion } from "@/lib/ai/pricing/settle-usage";
import { buildAiChatMessages } from "@/lib/ai/prompt-build";
import { withUserAiLock } from "@/lib/ai/rate-limit";
import type { AiProvider } from "@/lib/ai/types";
import { updateAiUsageEventStatus } from "@/lib/ai/usage";
import { getServerEnv } from "@/lib/env";
import { getAiConversation } from "@/lib/data/ai-conversations";
import {
  getAiJobById,
  type AiJobFence,
  type AiJobRow,
  updateAiJobWithFence,
} from "@/lib/data/ai-jobs";
import { createAiMessage, listAiMessages } from "@/lib/data/ai-messages";
import { releaseReservedUsageIfNeeded } from "@/lib/ai/jobs/release-budget";
import {
  ProviderCleanFailure,
  ProviderUncertainFailure,
} from "@/lib/ai/provider-errors";
import { usageLooksPresent } from "@/lib/ai/providers/openai-usage";

export { ProviderCleanFailure, ProviderUncertainFailure };

export type ExecuteAiJobInput = {
  job: AiJobRow;
  workerId: string;
  provider?: AiProvider;
  signal?: AbortSignal;
  now?: Date;
};

export type ExecuteAiJobResult =
  | { ok: true; job: AiJobRow; resultMessageId: string }
  | {
      ok: false;
      reason:
        | "stale_fence"
        | "provider_failed"
        | "provider_uncertain"
        | "missing_usage"
        | "aborted"
        | "canceled"
        | "invalid_output";
      job?: AiJobRow;
    };

function fenceOf(job: AiJobRow, workerId: string): AiJobFence {
  return {
    jobId: job.id,
    workerId,
    fencingToken: Number(job.fencingToken),
  };
}

function asPageContext(value: unknown): AiPageContext | null {
  if (!value || typeof value !== "object") return null;
  const path = "path" in value ? value.path : null;
  if (typeof path !== "string" || !path.trim()) return null;
  return value as AiPageContext;
}

function asTargetContext(value: unknown): AiTargetContext | null {
  if (!value || typeof value !== "object") return null;
  if (!("type" in value) || typeof value.type !== "string") return null;
  return value as AiTargetContext;
}

async function loadReservedUsage(db: Db, userId: string, usageEventId: string) {
  const [row] = await db
    .select()
    .from(aiUsageEvents)
    .where(
      and(eq(aiUsageEvents.id, usageEventId), eq(aiUsageEvents.userId, userId)),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Run one claimed job: resolve context + provider outside TX, then fenced settle.
 * Never awaits the provider inside a database transaction.
 *
 * Crash after `executionPhase=calling_provider` (including provider returned but
 * settle TX not committed): `recoverExpiredAiJobLeases` marks the job
 * `failed`+`uncertain` and `claimAiJobs` will NOT auto-retry — so reclaim does
 * not re-call the provider. Local usage may stay `reserved` until reconcile;
 * platform billing may already have occurred (catalog ≠ invoice).
 */
export async function executeAiJob(
  db: Db,
  input: ExecuteAiJobInput,
): Promise<ExecuteAiJobResult> {
  const now = input.now ?? new Date();
  const job = input.job;
  const fence = fenceOf(job, input.workerId);
  const provider = input.provider ?? getAiProvider();

  if (!job.usageEventId) {
    const fin = await updateAiJobWithFence(db, fence, {
      status: "failed",
      executionPhase: "after_provider",
      providerOutcome: "failed",
      errorCode: "missing_usage",
      errorMessage: "job missing usage_event_id",
      finishedAt: now,
      clearLock: true,
    });
    return {
      ok: false,
      reason: "missing_usage",
      job: fin.ok ? fin.job : undefined,
    };
  }

  const preflight = await shouldStopBeforeProvider(db, job);
  if (preflight.stop) {
    return finalizeCanceled(db, fence, job, now, preflight.code);
  }

  const phase = await updateAiJobWithFence(db, fence, {
    executionPhase: "calling_provider",
  });
  if (!phase.ok) {
    return { ok: false, reason: "stale_fence" };
  }

  if (input.signal?.aborted) {
    return finalizeUncertain(db, fence, job, now, "aborted_calling_provider");
  }

  const pageContext = asPageContext(job.pageContext);
  const targetContext = asTargetContext(job.targetContext);

  const resolved = await resolveAiContext(db, {
    userId: job.userId,
    pageContext,
    targetContext,
    conversation: { conversationId: job.conversationId },
  });

  const history = await listAiMessages(db, job.userId, job.conversationId);
  const chatMessages = buildAiChatMessages({
    fragments: resolved.fragments,
    history: history.map((m) => ({ role: m.role, content: m.content })),
  });

  let completion;
  try {
    completion = await provider.complete({
      feature: job.feature,
      model: job.model ?? undefined,
      messages: chatMessages,
      signal: input.signal,
      requestKey: job.id,
    });
  } catch (err) {
    if (input.signal?.aborted || err instanceof ProviderUncertainFailure) {
      return finalizeUncertain(
        db,
        fence,
        job,
        now,
        err instanceof ProviderUncertainFailure
          ? err.code
          : "provider_uncertain",
        err instanceof Error ? err.message : "provider outcome unknown",
      );
    }
    const clean =
      err instanceof ProviderCleanFailure
        ? err
        : new ProviderCleanFailure(
            err instanceof Error ? err.message : "provider failed",
          );
    return finalizeCleanFailure(db, fence, job, now, clean);
  }

  const conv = await getAiConversation(db, job.userId, job.conversationId);
  const discardAssistant = !conv || conv.status === "deleted";
  const emptyText = !completion.text.trim();

  // Empty text + usage: bill actual cost; do not release as free / uncertain.
  if (emptyText && !usageLooksPresent(completion.usage)) {
    return finalizeCleanFailure(
      db,
      fence,
      job,
      now,
      new ProviderCleanFailure("empty output without usage", "invalid_output"),
    );
  }

  try {
    const settled = await db.transaction(async (tx) => {
      return withUserAiLock(tx, job.userId, async () => {
        const usage = await loadReservedUsage(tx, job.userId, job.usageEventId!);
        if (!usage) {
          return { kind: "missing_usage" as const };
        }

        // Idempotent: already settled (e.g. duplicate worker) — do not double-charge.
        if (usage.status !== "reserved") {
          const fin = await updateAiJobWithFence(tx, fence, {
            status:
              usage.status === "ok"
                ? discardAssistant
                  ? "canceled"
                  : "succeeded"
                : "failed",
            executionPhase: "after_provider",
            providerOutcome:
              usage.status === "ok" ? "succeeded" : "failed",
            finishedAt: now,
            clearLock: true,
          });
          if (!fin.ok) throw new StaleFenceAbort();
          return {
            kind: "already_settled" as const,
            job: fin.job,
            status: usage.status,
          };
        }

        // Actual cost uses current catalog pricing version (not OpenAI invoice).
        const patch = buildSettledUsageFromCompletion(completion, {
          pricingVersion: getServerEnv().AI_PRICING_VERSION,
          extraErrorCode: discardAssistant
            ? "discarded_conversation_deleted"
            : emptyText
              ? "empty_output_with_usage"
              : null,
        });

        let resultMessageId: string | null = null;
        if (!discardAssistant && !emptyText) {
          const assistant = await createAiMessage(
            tx,
            job.userId,
            job.conversationId,
            {
              role: "assistant",
              content: completion.text,
              pageContext,
              targetContext,
            },
          );
          resultMessageId = assistant.id;
        }

        await settleBudgets(tx, {
          userId: job.userId,
          reservedUsd: usage.estimatedCostUsd,
          actualUsd: patch.estimatedCostUsd,
          success: true,
          now,
        });

        await updateAiUsageEventStatus(tx, job.userId, usage.id, {
          status: patch.status,
          inputTokens: patch.inputTokens,
          outputTokens: patch.outputTokens,
          cachedInputTokens: patch.cachedInputTokens,
          reasoningTokens: patch.reasoningTokens,
          estimatedCostUsd: patch.estimatedCostUsd,
          pricingVersion: patch.pricingVersion,
          providerResponseId: patch.providerResponseId,
          latencyMs: patch.latencyMs,
          errorCode: patch.errorCode,
          model: patch.model,
        });

        const jobStatus = emptyText
          ? "failed"
          : discardAssistant
            ? "canceled"
            : "succeeded";
        const fin = await updateAiJobWithFence(tx, fence, {
          status: jobStatus,
          executionPhase: "after_provider",
          providerOutcome: emptyText ? "failed" : "succeeded",
          resultMessageId,
          resultPayload: {
            text: completion.text,
            model: completion.model,
            provider: completion.provider,
            discarded: discardAssistant,
            emptyOutput: emptyText,
            providerResponseId: completion.providerResponseId ?? null,
          },
          provider: completion.provider,
          model: completion.model,
          errorCode: emptyText
            ? "empty_output_with_usage"
            : discardAssistant
              ? "conversation_deleted"
              : null,
          errorMessage: emptyText
            ? "provider returned usage but empty text; cost settled"
            : discardAssistant
              ? "provider result discarded; conversation deleted"
              : null,
          finishedAt: now,
          clearLock: true,
        });

        if (!fin.ok) {
          throw new StaleFenceAbort();
        }

        return {
          kind: "ok" as const,
          job: fin.job,
          resultMessageId: resultMessageId ?? "",
          discarded: discardAssistant,
          emptyOutput: emptyText,
        };
      });
    });

    if (settled.kind === "missing_usage") {
      return { ok: false, reason: "missing_usage" };
    }
    if (settled.kind === "already_settled") {
      return {
        ok: false,
        reason: settled.status === "ok" ? "stale_fence" : "invalid_output",
        job: settled.job,
      };
    }
    if (settled.emptyOutput) {
      return { ok: false, reason: "invalid_output", job: settled.job };
    }
    if (settled.discarded) {
      return { ok: false, reason: "canceled", job: settled.job };
    }
    return {
      ok: true,
      job: settled.job,
      resultMessageId: settled.resultMessageId,
    };
  } catch (err) {
    if (err instanceof StaleFenceAbort) {
      return { ok: false, reason: "stale_fence" };
    }
    throw err;
  }
}

async function shouldStopBeforeProvider(
  db: Db,
  job: AiJobRow,
): Promise<{ stop: boolean; code: string }> {
  const fresh = await getAiJobById(db, job.id);
  if (fresh?.cancelRequestedAt) {
    return { stop: true, code: "canceled" };
  }
  const conv = await getAiConversation(db, job.userId, job.conversationId);
  if (!conv || conv.status === "deleted") {
    return { stop: true, code: "conversation_deleted" };
  }
  return { stop: false, code: "" };
}

async function finalizeCanceled(
  db: Db,
  fence: AiJobFence,
  job: AiJobRow,
  now: Date,
  code: string,
): Promise<ExecuteAiJobResult> {
  try {
    const fin = await db.transaction(async (tx) => {
      return withUserAiLock(tx, job.userId, async () => {
        await releaseReservedUsageIfNeeded(tx, {
          userId: job.userId,
          usageEventId: job.usageEventId,
          errorCode: code,
          now,
        });
        const updated = await updateAiJobWithFence(tx, fence, {
          status: "canceled",
          executionPhase: "before_provider",
          providerOutcome: "not_started",
          errorCode: code,
          errorMessage: code,
          finishedAt: now,
          clearLock: true,
        });
        if (!updated.ok) throw new StaleFenceAbort();
        return updated.job;
      });
    });
    return { ok: false, reason: "canceled", job: fin };
  } catch (e) {
    if (e instanceof StaleFenceAbort) {
      return { ok: false, reason: "stale_fence" };
    }
    throw e;
  }
}

class StaleFenceAbort extends Error {
  constructor() {
    super("stale_fence");
    this.name = "StaleFenceAbort";
  }
}

async function finalizeCleanFailure(
  db: Db,
  fence: AiJobFence,
  job: AiJobRow,
  now: Date,
  err: ProviderCleanFailure,
): Promise<ExecuteAiJobResult> {
  try {
    const fin = await db.transaction(async (tx) => {
      return withUserAiLock(tx, job.userId, async () => {
        const usage = job.usageEventId
          ? await loadReservedUsage(tx, job.userId, job.usageEventId)
          : null;
        if (usage && usage.status === "reserved") {
          await settleBudgets(tx, {
            userId: job.userId,
            reservedUsd: usage.estimatedCostUsd,
            actualUsd: "0",
            success: false,
            now,
          });
          await updateAiUsageEventStatus(tx, job.userId, usage.id, {
            status: "error",
            errorCode: err.code,
            estimatedCostUsd: "0",
          });
        }

        const updated = await updateAiJobWithFence(tx, fence, {
          status: "failed",
          executionPhase: "after_provider",
          providerOutcome: "failed",
          errorCode: err.code,
          errorMessage: err.message.slice(0, 500),
          finishedAt: now,
          clearLock: true,
        });
        if (!updated.ok) throw new StaleFenceAbort();
        return updated.job;
      });
    });
    return { ok: false, reason: "provider_failed", job: fin };
  } catch (e) {
    if (e instanceof StaleFenceAbort) {
      return { ok: false, reason: "stale_fence" };
    }
    throw e;
  }
}

async function finalizeUncertain(
  db: Db,
  fence: AiJobFence,
  job: AiJobRow,
  now: Date,
  code: string,
  message = "provider outcome unknown",
): Promise<ExecuteAiJobResult> {
  // Do not release reserved budget automatically — billing may have occurred.
  // Do not auto-retry (provider_outcome=uncertain excludes reclaim).
  const updated = await updateAiJobWithFence(db, fence, {
    status: "failed",
    executionPhase: "after_provider",
    providerOutcome: "uncertain",
    errorCode: code,
    errorMessage: message.slice(0, 500),
    finishedAt: now,
    clearLock: true,
  });
  if (!updated.ok) {
    return { ok: false, reason: "stale_fence" };
  }
  return { ok: false, reason: "provider_uncertain", job: updated.job };
}
