import { and, eq, gte, lt, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { aiUsageEvents, type AiUsageStatus } from "@/db/schema";

export type AiUsageEventRow = typeof aiUsageEvents.$inferSelect;

export type AiUsageEventInput = {
  feature: string;
  provider: string;
  model?: string | null;
  promptVersion?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
  estimatedCostUsd?: string;
  pricingVersion?: string | null;
  providerResponseId?: string | null;
  latencyMs?: number | null;
  status: AiUsageStatus;
  errorCode?: string | null;
  requestId?: string | null;
  conversationId?: string | null;
};

export async function insertAiUsageEvent(
  db: Db,
  userId: string,
  input: AiUsageEventInput,
) {
  const [row] = await db
    .insert(aiUsageEvents)
    .values({
      userId,
      feature: input.feature,
      provider: input.provider,
      model: input.model ?? null,
      promptVersion: input.promptVersion ?? null,
      inputTokens: input.inputTokens ?? 0,
      outputTokens: input.outputTokens ?? 0,
      cachedInputTokens: input.cachedInputTokens ?? 0,
      reasoningTokens: input.reasoningTokens ?? 0,
      estimatedCostUsd: input.estimatedCostUsd ?? "0",
      pricingVersion: input.pricingVersion ?? null,
      providerResponseId: input.providerResponseId ?? null,
      latencyMs: input.latencyMs ?? null,
      status: input.status,
      errorCode: input.errorCode ?? null,
      requestId: input.requestId ?? null,
      conversationId: input.conversationId ?? null,
    })
    .returning();
  return row;
}

export async function updateAiUsageEventStatus(
  db: Db,
  userId: string,
  id: string,
  patch: {
    status: AiUsageStatus;
    inputTokens?: number;
    outputTokens?: number;
    cachedInputTokens?: number;
    reasoningTokens?: number;
    estimatedCostUsd?: string;
    pricingVersion?: string | null;
    providerResponseId?: string | null;
    latencyMs?: number | null;
    errorCode?: string | null;
    model?: string | null;
  },
) {
  const [row] = await db
    .update(aiUsageEvents)
    .set({
      status: patch.status,
      ...(patch.inputTokens !== undefined
        ? { inputTokens: patch.inputTokens }
        : {}),
      ...(patch.outputTokens !== undefined
        ? { outputTokens: patch.outputTokens }
        : {}),
      ...(patch.cachedInputTokens !== undefined
        ? { cachedInputTokens: patch.cachedInputTokens }
        : {}),
      ...(patch.reasoningTokens !== undefined
        ? { reasoningTokens: patch.reasoningTokens }
        : {}),
      ...(patch.estimatedCostUsd !== undefined
        ? { estimatedCostUsd: patch.estimatedCostUsd }
        : {}),
      ...(patch.pricingVersion !== undefined
        ? { pricingVersion: patch.pricingVersion }
        : {}),
      ...(patch.providerResponseId !== undefined
        ? { providerResponseId: patch.providerResponseId }
        : {}),
      ...(patch.latencyMs !== undefined ? { latencyMs: patch.latencyMs } : {}),
      ...(patch.errorCode !== undefined ? { errorCode: patch.errorCode } : {}),
      ...(patch.model !== undefined ? { model: patch.model } : {}),
    })
    .where(and(eq(aiUsageEvents.id, id), eq(aiUsageEvents.userId, userId)))
    .returning();
  return row ?? null;
}

export async function sumAiUsageCostUsd(
  db: Db,
  userId: string,
  fromInclusive: Date,
  toExclusive: Date,
) {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${aiUsageEvents.estimatedCostUsd}), 0)`,
    })
    .from(aiUsageEvents)
    .where(
      and(
        eq(aiUsageEvents.userId, userId),
        gte(aiUsageEvents.createdAt, fromInclusive),
        lt(aiUsageEvents.createdAt, toExclusive),
        eq(aiUsageEvents.status, "ok"),
      ),
    );
  return row?.total ?? "0";
}
