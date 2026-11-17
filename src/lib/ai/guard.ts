import type { Db } from "@/db";
import { getServerEnv, resolveAiModel } from "@/lib/env";
import { getAiProvider } from "@/lib/ai/provider";
import { estimateReservation } from "@/lib/ai/pricing/reserve";
import { buildSettledUsageFromCompletion } from "@/lib/ai/pricing/settle-usage";
import { checkAndReserveBudgets, settleBudgets } from "@/lib/ai/budget";
import { checkUserRateLimit, withUserAiLock } from "@/lib/ai/rate-limit";
import {
  findAiUsageByRequestId,
  insertAiUsageEvent,
  updateAiUsageEventStatus,
} from "@/lib/ai/usage";
import { usageLooksPresent } from "@/lib/ai/providers/openai-usage";
import type {
  AiChatMessage,
  AiGuardOutcome,
  AiProvider,
} from "@/lib/ai/types";

export type GuardedCompleteInput = {
  userId: string;
  /** Idempotency key — same key must not double-charge. */
  requestId: string;
  feature: string;
  messages: AiChatMessage[];
  conversationId?: string | null;
  model?: string;
  /** Override provider (tests). */
  provider?: AiProvider;
  now?: Date;
};

type ReserveOk = {
  kind: "ready";
  usageEventId: string;
  reservedUsd: string;
  provider: AiProvider;
};

type ReserveEarly = { kind: "done"; outcome: AiGuardOutcome };

async function reservePhase(
  db: Db,
  input: GuardedCompleteInput,
  provider: AiProvider,
  estimatedTokens: number,
  estimatedCostUsd: string,
  pricingVersion: string,
  model: string,
  now: Date,
): Promise<ReserveOk | ReserveEarly> {
  const env = getServerEnv();

  return db.transaction(async (tx) => {
    return withUserAiLock(tx, input.userId, async () => {
      const existing = await findAiUsageByRequestId(
        tx,
        input.userId,
        input.requestId,
      );

      if (existing) {
        if (existing.status === "ok" || existing.status === "invalid_output") {
          return {
            kind: "done" as const,
            outcome: {
              ok: true as const,
              result: await provider.complete({
                feature: input.feature,
                model: input.model,
                messages: input.messages,
              }),
              usageEventId: existing.id,
              replayed: true,
            },
          };
        }

        if (
          existing.status === "rejected_rate" ||
          existing.status === "rejected_budget"
        ) {
          return {
            kind: "done" as const,
            outcome: {
              ok: false as const,
              code:
                existing.status === "rejected_rate"
                  ? ("rate_limited" as const)
                  : ("budget_exceeded" as const),
              message: "duplicate rejected request",
              usageEventId: existing.id,
              detail: existing.errorCode ?? existing.status,
            },
          };
        }

        if (existing.status === "reserved") {
          const ageMs = now.getTime() - existing.createdAt.getTime();
          const STALE_MS = 60_000;
          if (ageMs < STALE_MS) {
            return {
              kind: "done" as const,
              outcome: {
                ok: false as const,
                code: "duplicate_request" as const,
                message: "request already in progress",
                usageEventId: existing.id,
              },
            };
          }
          await settleBudgets(tx, {
            userId: input.userId,
            reservedUsd: existing.estimatedCostUsd,
            actualUsd: "0",
            success: false,
            now,
          });
          await updateAiUsageEventStatus(tx, input.userId, existing.id, {
            status: "error",
            errorCode: "abandoned_reservation",
          });
        }
      }

      const rate = await checkUserRateLimit(
        tx,
        input.userId,
        env.AI_RATE_LIMIT_PER_MINUTE,
        now,
      );
      if (!rate.allowed) {
        const rejected = await insertAiUsageEvent(tx, input.userId, {
          feature: input.feature,
          provider: provider.id,
          model,
          status: "rejected_rate",
          errorCode: "rate_limited",
          requestId: input.requestId,
          conversationId: input.conversationId ?? null,
          estimatedCostUsd: "0",
          pricingVersion,
        });
        return {
          kind: "done" as const,
          outcome: {
            ok: false as const,
            code: "rate_limited" as const,
            message: `rate limit ${rate.current}/${rate.limit} per minute`,
            usageEventId: rejected.id,
          },
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
        const rejected = await insertAiUsageEvent(tx, input.userId, {
          feature: input.feature,
          provider: provider.id,
          model,
          status: "rejected_budget",
          errorCode: budget.reason,
          requestId: input.requestId,
          conversationId: input.conversationId ?? null,
          estimatedCostUsd: "0",
          pricingVersion,
        });
        return {
          kind: "done" as const,
          outcome: {
            ok: false as const,
            code: "budget_exceeded" as const,
            message: "budget exceeded",
            usageEventId: rejected.id,
            detail: budget.detail,
          },
        };
      }

      const reserved = await insertAiUsageEvent(tx, input.userId, {
        feature: input.feature,
        provider: provider.id,
        model,
        inputTokens: estimatedTokens,
        outputTokens: 0,
        estimatedCostUsd,
        pricingVersion,
        status: "reserved",
        requestId: input.requestId,
        conversationId: input.conversationId ?? null,
      });

      return {
        kind: "ready" as const,
        usageEventId: reserved.id,
        reservedUsd: estimatedCostUsd,
        provider,
      };
    });
  });
}

async function settlePhase(
  db: Db,
  input: GuardedCompleteInput,
  reserved: ReserveOk,
  now: Date,
): Promise<AiGuardOutcome> {
  let result;
  try {
    result = await reserved.provider.complete({
      feature: input.feature,
      model: input.model,
      messages: input.messages,
    });
  } catch (err) {
    await db.transaction(async (tx) => {
      await withUserAiLock(tx, input.userId, async () => {
        await settleBudgets(tx, {
          userId: input.userId,
          reservedUsd: reserved.reservedUsd,
          actualUsd: "0",
          success: false,
          now,
        });
        await updateAiUsageEventStatus(tx, input.userId, reserved.usageEventId, {
          status: "error",
          errorCode: "provider_error",
          estimatedCostUsd: "0",
        });
      });
    });
    throw err;
  }

  const empty = !result.text.trim();
  if (empty && !usageLooksPresent(result.usage)) {
    await db.transaction(async (tx) => {
      await withUserAiLock(tx, input.userId, async () => {
        await settleBudgets(tx, {
          userId: input.userId,
          reservedUsd: reserved.reservedUsd,
          actualUsd: "0",
          success: false,
          now,
        });
        await updateAiUsageEventStatus(tx, input.userId, reserved.usageEventId, {
          status: "error",
          errorCode: "invalid_output",
          estimatedCostUsd: "0",
        });
      });
    });
    return {
      ok: false,
      code: "invalid_request",
      message: "empty output without usage",
      usageEventId: reserved.usageEventId,
    };
  }

  const patch = buildSettledUsageFromCompletion(result, {
    pricingVersion: getServerEnv().AI_PRICING_VERSION,
  });

  await db.transaction(async (tx) => {
    await withUserAiLock(tx, input.userId, async () => {
      await settleBudgets(tx, {
        userId: input.userId,
        reservedUsd: reserved.reservedUsd,
        actualUsd: patch.estimatedCostUsd,
        success: true,
        now,
      });
      await updateAiUsageEventStatus(tx, input.userId, reserved.usageEventId, {
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
    });
  });

  if (empty) {
    return {
      ok: false,
      code: "invalid_request",
      message: "empty output with usage settled",
      usageEventId: reserved.usageEventId,
      detail: "empty_output_with_usage",
    };
  }

  return {
    ok: true,
    result,
    usageEventId: reserved.usageEventId,
  };
}

/**
 * Orchestrates rate limit → token/cost budget reserve → provider → settle + usage.
 * Reserve and settle are separate transactions so a crash leaves a recoverable
 * `reserved` row (released on the next attempt with the same requestId).
 * Does not persist message/resume body into usage events.
 */
export async function guardedComplete(
  db: Db,
  input: GuardedCompleteInput,
): Promise<AiGuardOutcome> {
  const env = getServerEnv();
  const now = input.now ?? new Date();

  if (!env.AI_ENABLED) {
    return {
      ok: false,
      code: "ai_unavailable",
      message: "AI is disabled",
    };
  }

  if (!input.requestId.trim()) {
    return {
      ok: false,
      code: "invalid_request",
      message: "requestId is required",
    };
  }

  if (input.messages.length === 0) {
    return {
      ok: false,
      code: "invalid_request",
      message: "messages must not be empty",
    };
  }

  const provider = input.provider ?? getAiProvider();
  let model: string;
  try {
    model = resolveAiModel(input.model, env);
  } catch (err) {
    return {
      ok: false,
      code: "invalid_request",
      message: err instanceof Error ? err.message : "model not allowed",
    };
  }

  let reserve;
  try {
    reserve = estimateReservation({
      messages: input.messages,
      model,
      maxOutputTokens: env.AI_OPENAI_MAX_OUTPUT_TOKENS,
      pricingVersion: env.AI_PRICING_VERSION,
    });
  } catch (err) {
    return {
      ok: false,
      code: "invalid_request",
      message: err instanceof Error ? err.message : "pricing unavailable",
    };
  }

  const phase1 = await reservePhase(
    db,
    input,
    provider,
    reserve.estimatedTokens,
    reserve.estimatedCostUsd,
    reserve.pricingVersion,
    model,
    now,
  );
  if (phase1.kind === "done") {
    return phase1.outcome;
  }

  return settlePhase(db, input, phase1, now);
}
