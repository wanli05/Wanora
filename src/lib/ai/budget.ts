import type { Db } from "@/db";
import {
  reserveAiDailyBudget,
  settleAiDailyBudget,
} from "@/lib/data/ai-budget";
import {
  startOfTokyoDay,
  sumAiTokensForUserSince,
} from "@/lib/ai/usage";

export type BudgetCheckInput = {
  userId: string;
  /** Estimated USD cost to reserve (string decimal). */
  estimatedCostUsd: string;
  /** Estimated total tokens for this call. */
  estimatedTokens: number;
  userDailyTokenBudget: number;
  userDailyCostBudgetUsd: number;
  globalDailyCostBudgetUsd: number;
  now?: Date;
};

export type BudgetCheckResult =
  | { allowed: true; reservedUsd: string }
  | {
      allowed: false;
      reason: "user_token" | "user_cost" | "global_cost";
      detail: string;
    };

/**
 * Concurrent-safe budget gate:
 * - daily token sum from `ai_usage_events` (caller should hold per-user advisory lock)
 * - USD reserve for user + global via `ai_daily_budget_counters` SELECT FOR UPDATE
 */
export async function checkAndReserveBudgets(
  db: Db,
  input: BudgetCheckInput,
): Promise<BudgetCheckResult> {
  const now = input.now ?? new Date();
  const dayStart = startOfTokyoDay(now);
  const tokensUsed = await sumAiTokensForUserSince(db, input.userId, dayStart);
  if (tokensUsed + input.estimatedTokens > input.userDailyTokenBudget) {
    return {
      allowed: false,
      reason: "user_token",
      detail: `tokens ${tokensUsed}+${input.estimatedTokens} > ${input.userDailyTokenBudget}`,
    };
  }

  const reserve = await reserveAiDailyBudget(db, {
    userId: input.userId,
    estimateUsd: input.estimatedCostUsd,
    userBudgetUsd: input.userDailyCostBudgetUsd,
    globalBudgetUsd: input.globalDailyCostBudgetUsd,
    now,
  });

  if (!reserve.ok) {
    return {
      allowed: false,
      reason: reserve.reason === "user_budget" ? "user_cost" : "global_cost",
      detail: reserve.reason,
    };
  }

  return { allowed: true, reservedUsd: input.estimatedCostUsd };
}

export async function settleBudgets(
  db: Db,
  args: {
    userId: string;
    reservedUsd: string;
    actualUsd: string;
    success: boolean;
    now?: Date;
  },
) {
  await settleAiDailyBudget(db, {
    userId: args.userId,
    reservedUsd: args.reservedUsd,
    actualUsd: args.actualUsd,
    success: args.success,
    now: args.now,
  });
}
