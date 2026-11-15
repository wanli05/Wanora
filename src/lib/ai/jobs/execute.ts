import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { aiUsageEvents } from "@/db/schema";
import { settleBudgets } from "@/lib/ai/budget";
import { resolveAiContext } from "@/lib/ai/context/resolve";
import type { AiPageContext, AiTargetContext } from "@/lib/ai/context/types";
import { getAiProvider } from "@/lib/ai/provider";
import { mockEstimatedCostUsd } from "@/lib/ai/providers/mock";
import { withUserAiLock } from "@/lib/ai/rate-limit";
import type { AiChatMessage, AiProvider } from "@/lib/ai/types";
import { updateAiUsageEventStatus } from "@/lib/ai/usage";
import {
  type AiJobFence,
  type AiJobRow,
  updateAiJobWithFence,
} from "@/lib/data/ai-jobs";
import { createAiMessage, listAiMessages } from "@/lib/data/ai-messages";

/** Provider threw a confirmed non-billing failure (safe to settle release). */
export class ProviderCleanFailure extends Error {
  readonly code: string;
  constructor(message: string, code = "provider_failed") {
    super(message);
    this.name = "ProviderCleanFailure";
    this.code = code;
  }
}

/** Provider outcome unknown — must not auto-retry or assume free. */
export class ProviderUncertainFailure extends Error {
  readonly code: string;
  constructor(message: string, code = "provider_uncertain") {
    super(message);
    this.name = "ProviderUncertainFailure";
    this.code = code;
  }
}

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
        | "aborted";
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

function formatContextForPrompt(
  fragments: { label: string; data: unknown }[],
): string {
  if (fragments.length === 0) return "";
  const parts = fragments.map((f) => {
    const body =
      typeof f.data === "string" ? f.data : JSON.stringify(f.data, null, 0);
    return `### ${f.label}\n${body}`;
  });
  return `【参照コンテキスト】\n${parts.join("\n\n")}`;
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
    return { ok: false, reason: "missing_usage" };
  }

  const phase = await updateAiJobWithFence(db, fence, {
    executionPhase: "calling_provider",
  });
  if (!phase.ok) {
    return { ok: false, reason: "stale_fence" };
  }

  if (input.signal?.aborted) {
    return finalizeUncertain(db, fence, job, now, "aborted_before_provider");
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
  const chatMessages: AiChatMessage[] = [];
  const contextBlock = formatContextForPrompt(resolved.fragments);
  if (contextBlock) {
    chatMessages.push({ role: "system", content: contextBlock });
  }
  for (const m of history) {
    if (m.role === "system" || m.role === "user" || m.role === "assistant") {
      chatMessages.push({ role: m.role, content: m.content });
    }
  }

  let completion;
  try {
    completion = await provider.complete({
      feature: job.feature,
      model: job.model ?? undefined,
      messages: chatMessages,
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

  // Persist success: assistant + settle + usage + job terminal — one TX, fenced.
  try {
    const settled = await db.transaction(async (tx) => {
      return withUserAiLock(tx, job.userId, async () => {
        const usage = await loadReservedUsage(tx, job.userId, job.usageEventId!);
        if (!usage) {
          return { kind: "missing_usage" as const };
        }

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

        const actualTokens =
          completion.usage.inputTokens + completion.usage.outputTokens;
        const actualCostUsd = mockEstimatedCostUsd(actualTokens);

        await settleBudgets(tx, {
          userId: job.userId,
          reservedUsd: usage.estimatedCostUsd,
          actualUsd: actualCostUsd,
          success: true,
          now,
        });

        await updateAiUsageEventStatus(tx, job.userId, usage.id, {
          status: "ok",
          inputTokens: completion.usage.inputTokens,
          outputTokens: completion.usage.outputTokens,
          estimatedCostUsd: actualCostUsd,
          latencyMs: completion.latencyMs,
          errorCode: null,
          model: completion.model,
        });

        const fin = await updateAiJobWithFence(tx, fence, {
          status: "succeeded",
          executionPhase: "after_provider",
          providerOutcome: "succeeded",
          resultMessageId: assistant.id,
          resultPayload: {
            text: completion.text,
            model: completion.model,
            provider: completion.provider,
          },
          provider: completion.provider,
          model: completion.model,
          finishedAt: now,
          clearLock: true,
        });

        if (!fin.ok) {
          // Roll back message + settle — stale worker must not double-charge.
          throw new StaleFenceAbort();
        }

        return {
          kind: "ok" as const,
          job: fin.job,
          resultMessageId: assistant.id,
        };
      });
    });

    if (settled.kind === "missing_usage") {
      return { ok: false, reason: "missing_usage" };
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
