import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { aiUsageEvents, type AiUsageStatus } from "@/db/schema";
import {
  insertAiUsageEvent,
  updateAiUsageEventStatus,
  type AiUsageEventInput,
} from "@/lib/data/ai-usage";

export {
  insertAiUsageEvent,
  updateAiUsageEventStatus,
  type AiUsageEventInput,
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

const TOKEN_STATUSES: AiUsageStatus[] = ["ok", "reserved"];

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
