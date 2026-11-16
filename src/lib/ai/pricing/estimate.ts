import type { AiTokenUsage } from "@/lib/ai/types";
import {
  DEFAULT_PRICING_CATALOG,
  getModelRates,
  type PricingCatalog,
} from "@/lib/ai/pricing/catalog";
import {
  addMicros,
  costMicrosForTokens,
  microsToUsd,
  type UsdMicros,
} from "@/lib/ai/pricing/money";

export type EstimateCostInput = {
  model: string;
  usage: AiTokenUsage & { cacheWriteTokens?: number };
  /** Prefer env AI_PRICING_VERSION; must match catalog.version for settlement. */
  pricingVersion?: string;
  catalog?: PricingCatalog;
};

export type EstimateCostResult = {
  estimatedCostUsd: string;
  pricingVersion: string;
  model: string;
  breakdownMicros: {
    ordinaryInput: UsdMicros;
    cachedInput: UsdMicros;
    cacheWrite: UsdMicros;
    output: UsdMicros;
    total: UsdMicros;
  };
};

/**
 * Price-table estimate from provider usage (not OpenAI invoice).
 * ordinary input = input - cached - cache_write (floored at 0).
 * reasoning tokens are already inside outputTokens — not billed again.
 */
export function estimateCostUsd(input: EstimateCostInput): EstimateCostResult {
  const catalog = input.catalog ?? DEFAULT_PRICING_CATALOG;
  const version = input.pricingVersion ?? catalog.version;
  if (version !== catalog.version) {
    throw new Error(
      `pricing_version_mismatch:requested=${version}:catalog=${catalog.version}`,
    );
  }
  const rates = getModelRates(input.model, catalog);
  const cached = Math.max(0, input.usage.cachedInputTokens ?? 0);
  const cacheWrite = Math.max(0, input.usage.cacheWriteTokens ?? 0);
  const inputTokens = Math.max(0, input.usage.inputTokens);
  const ordinary = Math.max(0, inputTokens - cached - cacheWrite);
  const output = Math.max(0, input.usage.outputTokens);

  const ordinaryInput = costMicrosForTokens(ordinary, rates.inputPerMTok);
  const cachedInput = costMicrosForTokens(cached, rates.cachedInputPerMTok);
  const cacheWriteCost = costMicrosForTokens(
    cacheWrite,
    rates.cacheWritePerMTok ?? rates.inputPerMTok,
  );
  const outputCost = costMicrosForTokens(output, rates.outputPerMTok);
  const total = addMicros(
    ordinaryInput,
    cachedInput,
    cacheWriteCost,
    outputCost,
  );

  return {
    estimatedCostUsd: microsToUsd(total),
    pricingVersion: version,
    model: input.model,
    breakdownMicros: {
      ordinaryInput,
      cachedInput,
      cacheWrite: cacheWriteCost,
      output: outputCost,
      total,
    },
  };
}
