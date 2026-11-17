import type { AiCompletionResult, AiTokenUsage } from "@/lib/ai/types";
import { PRICING_CATALOG_VERSION } from "@/lib/ai/pricing/catalog";
import { estimateCostUsd } from "@/lib/ai/pricing/estimate";

export type SettledUsagePatch = {
  status: "ok" | "invalid_output";
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  estimatedCostUsd: string;
  pricingVersion: string;
  providerResponseId: string | null;
  latencyMs: number | null;
  model: string;
  errorCode: string | null;
};

/**
 * Map provider completion → usage event patch + USD estimate (catalog, not invoice).
 * Empty text with usage → invalid_output but still billed.
 *
 * Pure: does not read process.env / getServerEnv. Pass `pricingVersion` from
 * ServerEnv when settling in app code; unit tests can omit it.
 */
export function buildSettledUsageFromCompletion(
  completion: AiCompletionResult,
  options?: {
    pricingVersion?: string;
    /** Soft-deleted conversation discard etc. */
    extraErrorCode?: string | null;
  },
): SettledUsagePatch {
  const pricingVersion = options?.pricingVersion ?? PRICING_CATALOG_VERSION;
  const usage = completion.usage;
  const cacheWrite =
    typeof (usage as AiTokenUsage & { cacheWriteTokens?: number })
      .cacheWriteTokens === "number"
      ? (usage as AiTokenUsage & { cacheWriteTokens?: number }).cacheWriteTokens
      : undefined;

  const priced = estimateCostUsd({
    model: completion.model,
    pricingVersion,
    usage: { ...usage, cacheWriteTokens: cacheWrite },
  });

  const empty = !completion.text.trim();
  if (empty) {
    return {
      status: "invalid_output",
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cachedInputTokens: usage.cachedInputTokens ?? 0,
      reasoningTokens: usage.reasoningTokens ?? 0,
      estimatedCostUsd: priced.estimatedCostUsd,
      pricingVersion: priced.pricingVersion,
      providerResponseId: completion.providerResponseId ?? null,
      latencyMs: completion.latencyMs,
      model: completion.model,
      errorCode: options?.extraErrorCode ?? "empty_output_with_usage",
    };
  }

  return {
    status: "ok",
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cachedInputTokens: usage.cachedInputTokens ?? 0,
    reasoningTokens: usage.reasoningTokens ?? 0,
    estimatedCostUsd: priced.estimatedCostUsd,
    pricingVersion: priced.pricingVersion,
    providerResponseId: completion.providerResponseId ?? null,
    latencyMs: completion.latencyMs,
    model: completion.model,
    errorCode: options?.extraErrorCode ?? null,
  };
}
