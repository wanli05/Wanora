import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { aiJobs, aiUsageEvents } from "@/db/schema";
import type { AiUsageEventRow } from "@/lib/data/ai-usage";
import {
  displayAiUsageCost,
  type AiUsageCostDisplay,
} from "@/lib/ai/usage";

/** Default window for `pnpm ai:usage -- --recent`. */
export const AI_USAGE_RECENT_DEFAULT_LIMIT = 5;

export type RecentAiUsageRow = {
  createdAt: Date;
  /** Asia/Tokyo wall clock, e.g. 2026-11-29 01:55:03 JST */
  tokyoTime: string;
  userId: string;
  feature: string;
  provider: string;
  model: string | null;
  /** Job status when a job exists; otherwise usage.status. */
  jobStatus: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costDisplay: AiUsageCostDisplay;
  /** Human cost column: settled / reserved / unknown. */
  costLabel: string;
  clientRequestId: string;
};

export function formatTokyoDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")} JST`;
}

export function formatRecentCostLabel(cost: AiUsageCostDisplay): string {
  if (cost.kind === "known") {
    return `$${cost.estimatedCostUsd} settled`;
  }
  if (cost.kind === "reserved") {
    return `$${cost.estimatedCostUsd} reserved`;
  }
  return `unknown (${cost.reason})`;
}

/**
 * Tokens for display: settled ok/invalid_output → real counts;
 * reserved → still show reserved estimate tokens; unknown → null.
 */
export function tokensForRecentDisplay(
  usage: Pick<
    AiUsageEventRow,
    "status" | "inputTokens" | "outputTokens" | "errorCode"
  > | null,
  cost: AiUsageCostDisplay,
): { inputTokens: number | null; outputTokens: number | null } {
  if (!usage) return { inputTokens: null, outputTokens: null };
  if (cost.kind === "unknown") {
    return { inputTokens: null, outputTokens: null };
  }
  if (
    usage.status === "ok" ||
    usage.status === "invalid_output" ||
    usage.status === "reserved"
  ) {
    return {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    };
  }
  return { inputTokens: null, outputTokens: null };
}

export function buildRecentAiUsageRow(input: {
  createdAt: Date;
  userId: string;
  feature: string;
  provider: string;
  model: string | null;
  jobStatus: string;
  clientRequestId: string;
  usage: AiUsageEventRow | null;
}): RecentAiUsageRow {
  const costDisplay = input.usage
    ? displayAiUsageCost(input.usage)
    : ({ kind: "unknown", reason: "missing_usage" } as const);
  const tokens = tokensForRecentDisplay(input.usage, costDisplay);
  return {
    createdAt: input.createdAt,
    tokyoTime: formatTokyoDateTime(input.createdAt),
    userId: input.userId,
    feature: input.feature,
    provider: input.provider,
    model: input.model,
    jobStatus: input.jobStatus,
    inputTokens: tokens.inputTokens,
    outputTokens: tokens.outputTokens,
    costDisplay,
    costLabel: formatRecentCostLabel(costDisplay),
    clientRequestId: input.clientRequestId,
  };
}

/** Pure: newest-first, optional user filter, hard cap. */
export function selectRecentAiUsageRows(
  rows: RecentAiUsageRow[],
  options?: { userId?: string; limit?: number },
): RecentAiUsageRow[] {
  const limit = options?.limit ?? AI_USAGE_RECENT_DEFAULT_LIMIT;
  const userId = options?.userId?.trim();
  const filtered = userId
    ? rows.filter((r) => r.userId === userId)
    : rows.slice();
  return filtered
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, Math.max(0, limit));
}

export function formatRecentAiUsageLine(row: RecentAiUsageRow): string {
  const inTok =
    row.inputTokens === null ? "-" : String(row.inputTokens);
  const outTok =
    row.outputTokens === null ? "-" : String(row.outputTokens);
  const model = row.model?.trim() || "-";
  return [
    row.tokyoTime,
    row.feature,
    row.provider,
    model,
    row.jobStatus,
    `in=${inTok}`,
    `out=${outTok}`,
    row.costLabel,
    row.clientRequestId,
  ].join("  ");
}

export function formatRecentAiUsageReport(rows: RecentAiUsageRow[]): string {
  if (rows.length === 0) {
    return "(no recent AI requests)";
  }
  const header =
    "# tokyoTime  feature  provider  model  jobStatus  in  out  cost  clientRequestId";
  return [header, ...rows.map(formatRecentAiUsageLine)].join("\n");
}

/**
 * List newest AI job requests (metadata only). Joins usage for tokens/cost.
 * Default limit 5; optional userId filter.
 */
export async function listRecentAiUsageRequests(
  db: Db,
  options?: { userId?: string; limit?: number },
): Promise<RecentAiUsageRow[]> {
  const limit = options?.limit ?? AI_USAGE_RECENT_DEFAULT_LIMIT;
  const userId = options?.userId?.trim();

  const jobs = userId
    ? await db
        .select()
        .from(aiJobs)
        .where(eq(aiJobs.userId, userId))
        .orderBy(desc(aiJobs.createdAt))
        .limit(limit)
    : await db
        .select()
        .from(aiJobs)
        .orderBy(desc(aiJobs.createdAt))
        .limit(limit);

  const rows: RecentAiUsageRow[] = [];
  for (const job of jobs) {
    let usage: AiUsageEventRow | null = null;
    if (job.usageEventId) {
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
      usage = linked ?? null;
    }
    rows.push(
      buildRecentAiUsageRow({
        createdAt: job.createdAt,
        userId: job.userId,
        feature: job.feature,
        provider: job.provider ?? usage?.provider ?? "unknown",
        model: job.model ?? usage?.model ?? null,
        jobStatus: job.status,
        clientRequestId: job.clientRequestId,
        usage,
      }),
    );
  }
  return rows;
}
