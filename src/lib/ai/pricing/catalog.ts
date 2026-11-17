/**
 * Versioned model price table (USD per 1M tokens, short-context standard tier).
 *
 * gpt-6.1-terra verified 2026-11-17 against OpenAI model/pricing docs:
 * Responses API supported; input $1 / cached $0.05 / cache write 30m $1.25 / output $5.
 * Account entitlement to call the model is environment-specific (not verified here).
 */
export const PRICING_CATALOG_VERSION = "2026-11-17";

export type ModelPriceRates = {
  inputPerMTok: string;
  cachedInputPerMTok: string;
  /** Optional; default 30m write rate when provider reports cache_write_tokens. */
  cacheWritePerMTok?: string;
  outputPerMTok: string;
};

export type PricingCatalog = {
  version: string;
  models: Record<string, ModelPriceRates>;
};

export const DEFAULT_PRICING_CATALOG: PricingCatalog = {
  version: PRICING_CATALOG_VERSION,
  models: {
    // Phase 1A mock: $0.00001 per token = $10 per 1M (kept for budget tests).
    "mock-v1": {
      inputPerMTok: "10.000000",
      cachedInputPerMTok: "10.000000",
      outputPerMTok: "10.000000",
    },
    "gpt-6.1-terra": {
      inputPerMTok: "1.000000",
      cachedInputPerMTok: "0.050000",
      cacheWritePerMTok: "1.250000",
      outputPerMTok: "5.000000",
    },
    // Still listed for allowlist / transition; deprecated by OpenAI ~2026-12-11.
    "gpt-5-mini": {
      inputPerMTok: "0.250000",
      cachedInputPerMTok: "0.025000",
      cacheWritePerMTok: "0.312500",
      outputPerMTok: "2.000000",
    },
  },
};

export function getModelRates(
  model: string,
  catalog: PricingCatalog = DEFAULT_PRICING_CATALOG,
): ModelPriceRates {
  const rates = catalog.models[model];
  if (!rates) {
    throw new Error(`unknown_model_pricing:${model}`);
  }
  return rates;
}
