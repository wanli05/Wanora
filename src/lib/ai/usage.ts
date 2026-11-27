import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { aiJobs, aiUsageEvents, type AiUsageStatus } from "@/db/schema";
import {
  insertAiUsageEvent,
  updateAiUsageEventStatus,
  type AiUsageEventInput,
  type AiUsageEventRow,
} from "@/lib/data/ai-usage";

export {
  insertAiUsageEvent,
  updateAiUsageEventStatus,
  type AiUsageEventInput,
  type AiUsageEventRow,
};

/** Find the latest usage row by client/request idempotency key. */
export async function findAiUsageByRequestId(
  db: Db,
  userId: string,
  requestId: string,
) {
  const [row] = await db
    .select()
    .from(aiUsageEvents)
    .where(
      and(
        eq(aiUsageEvents.userId, userId),
        eq(aiUsageEvents.requestId, requestId),
      ),
    )
    .orderBy(desc(aiUsageEvents.createdAt))
    .limit(1);
  return row ?? null;
}

/**
 * Ops / CLI: look up usage by request id across users (DB access required).
 * Returns metadata only — never joins message/prompt bodies.
 */
export async function findAiUsageByRequestIdAnyUser(
  db: Db,
  requestId: string,
) {
  const [row] = await db
    .select()
    .from(aiUsageEvents)
    .where(eq(aiUsageEvents.requestId, requestId))
    .orderBy(desc(aiUsageEvents.createdAt))
    .limit(1);
  return row ?? null;
}

export type AiUsageCostDisplay =
  | { kind: "known"; estimatedCostUsd: string }
  | { kind: "unknown"; reason: string }
  | { kind: "reserved"; estimatedCostUsd: string };

/**
 * Display helper: reserved holds estimated $; unknown never collapses to $0.
 * Terminal error without settled tokens → unknown when provider may have billed.
 */
export function displayAiUsageCost(row: AiUsageEventRow): AiUsageCostDisplay {
  if (row.status === "reserved") {
    return { kind: "reserved", estimatedCostUsd: row.estimatedCostUsd };
  }
  if (
    row.status === "ok" ||
    row.status === "invalid_output"
  ) {
    return { kind: "known", estimatedCostUsd: row.estimatedCostUsd };
  }
  if (
    row.errorCode === "usage_unknown" ||
    row.errorCode === "provider_uncertain" ||
    row.errorCode === "abandoned_reservation"
  ) {
    return {
      kind: "unknown",
      reason: row.errorCode ?? "usage_unknown",
    };
  }
  if (row.status === "rejected_budget" || row.status === "rejected_rate") {
    return { kind: "known", estimatedCostUsd: "0" };
  }
  // Clean provider errors released reserve → known $0; uncertain held separately.
  return { kind: "known", estimatedCostUsd: row.estimatedCostUsd };
}

export type AiUsageDaySummary = {
  timezone: "Asia/Tokyo";
  day: string;
  dayStartIso: string;
  dayEndExclusiveIso: string;
  userId: string;
  succeededJobs: number;
  usageEvents: number;
  callsWithTokens: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: string;
  /** Events whose cost display is unknown (not treated as $0). */
  unknownCostEvents: number;
};

/** Inclusive Tokyo calendar day → [start, nextDay). */
export function tokyoDayBounds(dayYmd: string): {
  dayStart: Date;
  dayEndExclusive: Date;
} {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayYmd)) {
    throw new Error(`invalid Tokyo day (expected YYYY-MM-DD): ${dayYmd}`);
  }
  const dayStart = new Date(`${dayYmd}T00:00:00+09:00`);
  const dayEndExclusive = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  return { dayStart, dayEndExclusive };
}

export async function summarizeAiUsageForUserDay(
  db: Db,
  userId: string,
  dayYmd: string,
): Promise<AiUsageDaySummary> {
  const { dayStart, dayEndExclusive } = tokyoDayBounds(dayYmd);

  const usageRows = await db
    .select()
    .from(aiUsageEvents)
    .where(
      and(
        eq(aiUsageEvents.userId, userId),
        gte(aiUsageEvents.createdAt, dayStart),
        lt(aiUsageEvents.createdAt, dayEndExclusive),
      ),
    )
    .orderBy(desc(aiUsageEvents.createdAt));

  const [succeeded] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(aiJobs)
    .where(
      and(
        eq(aiJobs.userId, userId),
        eq(aiJobs.status, "succeeded"),
        gte(aiJobs.createdAt, dayStart),
        lt(aiJobs.createdAt, dayEndExclusive),
      ),
    );

  let inputTokens = 0;
  let outputTokens = 0;
  let estimatedCostUsd = 0;
  let callsWithTokens = 0;
  let unknownCostEvents = 0;

  for (const row of usageRows) {
    const display = displayAiUsageCost(row);
    if (display.kind === "unknown") {
      unknownCostEvents += 1;
    } else if (display.kind === "known" || display.kind === "reserved") {
      estimatedCostUsd += Number(display.estimatedCostUsd);
    }
    const tokens = row.inputTokens + row.outputTokens;
    if (
      row.status === "ok" ||
      row.status === "invalid_output" ||
      row.status === "reserved"
    ) {
      inputTokens += row.inputTokens;
      outputTokens += row.outputTokens;
      if (tokens > 0) callsWithTokens += 1;
    }
  }

  return {
    timezone: "Asia/Tokyo",
    day: dayYmd,
    dayStartIso: dayStart.toISOString(),
    dayEndExclusiveIso: dayEndExclusive.toISOString(),
    userId,
    succeededJobs: succeeded?.n ?? 0,
    usageEvents: usageRows.length,
    callsWithTokens,
    inputTokens,
    outputTokens,
    estimatedCostUsd: estimatedCostUsd.toFixed(6),
    unknownCostEvents,
  };
}

/** Metadata-safe projection for CLI / logs (no prompt / resume body). */
export function serializeAiUsageMeta(row: AiUsageEventRow) {
  const cost = displayAiUsageCost(row);
  return {
    id: row.id,
    userId: row.userId,
    feature: row.feature,
    provider: row.provider,
    model: row.model,
    status: row.status,
    errorCode: row.errorCode,
    requestId: row.requestId,
    conversationId: row.conversationId,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    cachedInputTokens: row.cachedInputTokens,
    reasoningTokens: row.reasoningTokens,
    estimatedCostUsd: row.estimatedCostUsd,
    costDisplay:
      cost.kind === "unknown"
        ? { kind: "unknown" as const, reason: cost.reason }
        : cost.kind === "reserved"
          ? {
              kind: "reserved" as const,
              estimatedCostUsd: cost.estimatedCostUsd,
            }
          : {
              kind: "known" as const,
              estimatedCostUsd: cost.estimatedCostUsd,
            },
    pricingVersion: row.pricingVersion,
    providerResponseId: row.providerResponseId,
    latencyMs: row.latencyMs,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Statuses that count toward daily token/cost budgets (billed empty = invalid_output). */
const TOKEN_STATUSES: AiUsageStatus[] = ["ok", "reserved", "invalid_output"];

export async function sumAiTokensForUserSince(
  db: Db,
  userId: string,
  fromInclusive: Date,
) {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${aiUsageEvents.inputTokens} + ${aiUsageEvents.outputTokens}), 0)`,
    })
    .from(aiUsageEvents)
    .where(
      and(
        eq(aiUsageEvents.userId, userId),
        gte(aiUsageEvents.createdAt, fromInclusive),
        inArray(aiUsageEvents.status, TOKEN_STATUSES),
      ),
    );
  return Number(row?.total ?? 0);
}

/** Count rate-limit-consuming events in a time window (cross-process safe when locked). */
export async function countAiCallsSince(
  db: Db,
  userId: string,
  fromInclusive: Date,
  feature?: string,
) {
  const conditions = [
    eq(aiUsageEvents.userId, userId),
    gte(aiUsageEvents.createdAt, fromInclusive),
    inArray(aiUsageEvents.status, [
      "reserved",
      "ok",
      "error",
      "invalid_output",
    ] satisfies AiUsageStatus[]),
  ];
  if (feature) {
    conditions.push(eq(aiUsageEvents.feature, feature));
  }
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(aiUsageEvents)
    .where(and(...conditions));
  return row?.n ?? 0;
}

export function startOfTokyoDay(now = new Date()): Date {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return new Date(`${day}T00:00:00+09:00`);
}

export async function sumGlobalAiCostUsdSince(db: Db, fromInclusive: Date) {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${aiUsageEvents.estimatedCostUsd}), 0)`,
    })
    .from(aiUsageEvents)
    .where(
      and(
        gte(aiUsageEvents.createdAt, fromInclusive),
        inArray(aiUsageEvents.status, TOKEN_STATUSES),
      ),
    );
  return row?.total ?? "0";
}
