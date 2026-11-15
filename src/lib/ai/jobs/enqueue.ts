import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { aiMessages } from "@/db/schema";
import { getServerEnv } from "@/lib/env";
import { checkAndReserveBudgets } from "@/lib/ai/budget";
import type { AiPageContext, AiTargetContext } from "@/lib/ai/context/types";
import { getAiProvider } from "@/lib/ai/provider";
import { mockEstimatedCostUsd } from "@/lib/ai/providers/mock";
import { checkUserRateLimit, withUserAiLock } from "@/lib/ai/rate-limit";
import { insertAiUsageEvent } from "@/lib/ai/usage";
import { getActiveAiConversation } from "@/lib/data/ai-conversations";
import {
  findAiJobByClientRequestId,
  insertAiJob,
  type AiJobRow,
} from "@/lib/data/ai-jobs";
import { createAiMessage, type AiMessageRow } from "@/lib/data/ai-messages";

export type EnqueueAiJobInput = {
  userId: string;
  conversationId: string;
  clientRequestId: string;
  content: string;
  feature?: string;
  pageContext?: AiPageContext | null;
  targetContext?: AiTargetContext | null;
  model?: string;
  now?: Date;
};

export type EnqueueAiJobResult =
  | {
      ok: true;
      job: AiJobRow;
      userMessage: AiMessageRow;
      replayed: boolean;
    }
  | {
      ok: false;
      code:
        | "ai_unavailable"
        | "not_found"
        | "rate_limited"
        | "budget_exceeded"
        | "invalid_request";
      message: string;
      detail?: string;
    };

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  if (code === "23505") return true;
  const cause =
    "cause" in error && error.cause && typeof error.cause === "object"
      ? error.cause
      : null;
  return Boolean(cause && "code" in cause && String(cause.code) === "23505");
}

function estimateInputTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 2));
}

async function loadUserMessage(
  db: Db,
  userId: string,
  messageId: string | null,
): Promise<AiMessageRow | null> {
  if (!messageId) return null;
  const [msg] = await db
    .select()
    .from(aiMessages)
    .where(and(eq(aiMessages.id, messageId), eq(aiMessages.userId, userId)))
    .limit(1);
  return msg ?? null;
}

async function replayExisting(
  db: Db,
  userId: string,
  job: AiJobRow,
): Promise<EnqueueAiJobResult> {
  const userMessage = await loadUserMessage(db, userId, job.userMessageId);
  if (!userMessage) {
    throw new Error(
      `idempotent job ${job.id} missing user_message_id=${job.userMessageId}`,
    );
  }
  return { ok: true, job, userMessage, replayed: true };
}

/**
 * Atomically enqueue an AI job: rate/budget reserve + usage + user message + job.
 * Concurrent-safe idempotency via UNIQUE(user_id, client_request_id).
 */
export async function enqueueAiJob(
  db: Db,
  input: EnqueueAiJobInput,
): Promise<EnqueueAiJobResult> {
  const env = getServerEnv();
  const now = input.now ?? new Date();
  const feature = input.feature?.trim() || "chat";
  const clientRequestId = input.clientRequestId.trim();
  const content = input.content.trim();

  if (!env.AI_ENABLED) {
    return {
      ok: false,
      code: "ai_unavailable",
      message: "AI is disabled",
    };
  }
  if (!clientRequestId) {
    return {
      ok: false,
      code: "invalid_request",
      message: "clientRequestId is required",
    };
  }
  if (!content) {
    return {
      ok: false,
      code: "invalid_request",
      message: "content is required",
    };
  }

  const existing = await findAiJobByClientRequestId(
    db,
    input.userId,
    clientRequestId,
  );
  if (existing) {
    return replayExisting(db, input.userId, existing);
  }

  const conversation = await getActiveAiConversation(
    db,
    input.userId,
    input.conversationId,
  );
  if (!conversation) {
    return {
      ok: false,
      code: "not_found",
      message: "conversation not found or not active",
    };
  }

  const provider = getAiProvider();
  const estimatedTokens = estimateInputTokens(content) + 64;
  const estimatedCostUsd = mockEstimatedCostUsd(estimatedTokens);
  const model = input.model?.trim() || env.AI_DEFAULT_MODEL || "mock-v1";
  const pageContext = input.pageContext ?? null;
  const targetContext =
    input.targetContext !== undefined
      ? input.targetContext
      : ((conversation.pinnedTarget as AiTargetContext | null) ?? null);

  try {
    const created = await db.transaction(async (tx) => {
      return withUserAiLock(tx, input.userId, async () => {
        const again = await findAiJobByClientRequestId(
          tx,
          input.userId,
          clientRequestId,
        );
        if (again) {
          return { kind: "replay" as const, job: again };
        }

        const rate = await checkUserRateLimit(
          tx,
          input.userId,
          env.AI_RATE_LIMIT_PER_MINUTE,
          now,
        );
        if (!rate.allowed) {
          return {
            kind: "reject" as const,
            code: "rate_limited" as const,
            message: `rate limit ${rate.current}/${rate.limit} per minute`,
          };
        }

        const budget = await checkAndReserveBudgets(tx, {
          userId: input.userId,
          estimatedCostUsd,
          estimatedTokens,
          userDailyTokenBudget: env.AI_DAILY_TOKEN_BUDGET,
          userDailyCostBudgetUsd: env.AI_DAILY_COST_BUDGET_USD,
          globalDailyCostBudgetUsd: env.AI_GLOBAL_DAILY_COST_BUDGET_USD,
          now,
        });
        if (!budget.allowed) {
          return {
            kind: "reject" as const,
            code: "budget_exceeded" as const,
            message: "budget exceeded",
            detail: budget.detail,
          };
        }

        const usage = await insertAiUsageEvent(tx, input.userId, {
          feature,
          provider: provider.id,
          model,
          inputTokens: estimatedTokens,
          outputTokens: 0,
          estimatedCostUsd,
          status: "reserved",
          requestId: clientRequestId,
          conversationId: input.conversationId,
        });

        const userMessage = await createAiMessage(
          tx,
          input.userId,
          input.conversationId,
          {
            role: "user",
            content,
            pageContext,
            targetContext,
            clientMessageId: clientRequestId,
          },
        );

        const job = await insertAiJob(tx, input.userId, {
          conversationId: input.conversationId,
          clientRequestId,
          feature,
          userMessageId: userMessage.id,
          usageEventId: usage.id,
          pageContext,
          targetContext,
          provider: provider.id,
          model,
          status: "queued",
          executionPhase: "queued",
        });

        return {
          kind: "created" as const,
          job,
          userMessage,
        };
      });
    });

    if (created.kind === "replay") {
      return replayExisting(db, input.userId, created.job);
    }
    if (created.kind === "reject") {
      return {
        ok: false,
        code: created.code,
        message: created.message,
        detail: "detail" in created ? created.detail : undefined,
      };
    }

    return {
      ok: true,
      job: created.job,
      userMessage: created.userMessage,
      replayed: false,
    };
  } catch (err) {
    if (isUniqueViolation(err)) {
      const job = await findAiJobByClientRequestId(
        db,
        input.userId,
        clientRequestId,
      );
      if (job) return replayExisting(db, input.userId, job);
    }
    throw err;
  }
}
