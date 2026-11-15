import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/db";
import {
  aiDailyBudgetCounters,
  type AiBudgetScopeType,
} from "@/db/schema";

export type AiDailyBudgetCounterRow =
  typeof aiDailyBudgetCounters.$inferSelect;

function budgetDateString(d: Date): string {
  // Calendar day in Asia/Tokyo for product-facing daily caps.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

async function lockOrCreateCounter(
  tx: Db,
  scopeType: AiBudgetScopeType,
  scopeId: string,
  budgetDate: string,
) {
  await tx
    .insert(aiDailyBudgetCounters)
    .values({
      scopeType,
      scopeId,
      budgetDate,
      spentUsd: "0",
      reservedUsd: "0",
    })
    .onConflictDoNothing();

  const [row] = await tx
    .select()
    .from(aiDailyBudgetCounters)
    .where(
      and(
        eq(aiDailyBudgetCounters.scopeType, scopeType),
        eq(aiDailyBudgetCounters.scopeId, scopeId),
        eq(aiDailyBudgetCounters.budgetDate, budgetDate),
      ),
    )
    .for("update");

  if (!row) {
    throw new Error("ai_daily_budget_counters row missing after insert");
  }
  return row;
}

export type BudgetReserveResult =
  | { ok: true }
  | { ok: false; reason: "user_budget" | "global_budget" };

/**
 * Atomically reserve estimated USD against user + global daily caps.
 * Must be called inside a transaction for the FOR UPDATE locks to hold.
 */
export async function reserveAiDailyBudget(
  tx: Db,
  input: {
    userId: string;
    estimateUsd: string;
    userBudgetUsd: number;
    globalBudgetUsd: number;
    now?: Date;
  },
): Promise<BudgetReserveResult> {
  const now = input.now ?? new Date();
  const budgetDate = budgetDateString(now);
  const estimate = Number(input.estimateUsd);
  if (!(estimate >= 0) || Number.isNaN(estimate)) {
    throw new Error("invalid estimateUsd");
  }

  const userRow = await lockOrCreateCounter(tx, "user", input.userId, budgetDate);
  const globalRow = await lockOrCreateCounter(tx, "global", "global", budgetDate);

  const userUsed =
    Number(userRow.spentUsd) + Number(userRow.reservedUsd) + estimate;
  if (userUsed > input.userBudgetUsd) {
    return { ok: false, reason: "user_budget" };
  }

  const globalUsed =
    Number(globalRow.spentUsd) + Number(globalRow.reservedUsd) + estimate;
  if (globalUsed > input.globalBudgetUsd) {
    return { ok: false, reason: "global_budget" };
  }

  await tx
    .update(aiDailyBudgetCounters)
    .set({
      reservedUsd: sql`${aiDailyBudgetCounters.reservedUsd} + ${input.estimateUsd}::numeric`,
    })
    .where(
      and(
        eq(aiDailyBudgetCounters.scopeType, "user"),
        eq(aiDailyBudgetCounters.scopeId, input.userId),
        eq(aiDailyBudgetCounters.budgetDate, budgetDate),
      ),
    );

  await tx
    .update(aiDailyBudgetCounters)
    .set({
      reservedUsd: sql`${aiDailyBudgetCounters.reservedUsd} + ${input.estimateUsd}::numeric`,
    })
    .where(
      and(
        eq(aiDailyBudgetCounters.scopeType, "global"),
        eq(aiDailyBudgetCounters.scopeId, "global"),
        eq(aiDailyBudgetCounters.budgetDate, budgetDate),
      ),
    );

  return { ok: true };
}

/** Move reserved amount into spent (success) or release it (failure). */
export async function settleAiDailyBudget(
  tx: Db,
  input: {
    userId: string;
    reservedUsd: string;
    actualUsd: string;
    success: boolean;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const budgetDate = budgetDateString(now);
  const reserved = input.reservedUsd;
  const actual = input.success ? input.actualUsd : "0";

  for (const [scopeType, scopeId] of [
    ["user", input.userId],
    ["global", "global"],
  ] as const) {
    await lockOrCreateCounter(tx, scopeType, scopeId, budgetDate);
    await tx
      .update(aiDailyBudgetCounters)
      .set({
        reservedUsd: sql`greatest(${aiDailyBudgetCounters.reservedUsd} - ${reserved}::numeric, 0)`,
        spentUsd: sql`${aiDailyBudgetCounters.spentUsd} + ${actual}::numeric`,
      })
      .where(
        and(
          eq(aiDailyBudgetCounters.scopeType, scopeType),
          eq(aiDailyBudgetCounters.scopeId, scopeId),
          eq(aiDailyBudgetCounters.budgetDate, budgetDate),
        ),
      );
  }
}

export async function getAiDailyBudgetCounter(
  db: Db,
  scopeType: AiBudgetScopeType,
  scopeId: string,
  now = new Date(),
) {
  const budgetDate = budgetDateString(now);
  const [row] = await db
    .select()
    .from(aiDailyBudgetCounters)
    .where(
      and(
        eq(aiDailyBudgetCounters.scopeType, scopeType),
        eq(aiDailyBudgetCounters.scopeId, scopeId),
        eq(aiDailyBudgetCounters.budgetDate, budgetDate),
      ),
    )
    .limit(1);
  return row ?? null;
}
