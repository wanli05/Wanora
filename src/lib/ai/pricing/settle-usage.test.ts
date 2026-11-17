import { describe, expect, it } from "vitest";
import { PRICING_CATALOG_VERSION } from "@/lib/ai/pricing/catalog";
import { buildSettledUsageFromCompletion } from "@/lib/ai/pricing/settle-usage";
import type { AiCompletionResult } from "@/lib/ai/types";

function base(partial: Partial<AiCompletionResult>): AiCompletionResult {
  return {
    text: "ok",
    usage: { inputTokens: 100, outputTokens: 20 },
    provider: "mock",
    model: "mock-v1",
    latencyMs: 5,
    ...partial,
  };
}

describe("buildSettledUsageFromCompletion", () => {
  it("marks ok and prices usage on success", () => {
    const patch = buildSettledUsageFromCompletion(base({}), {
      pricingVersion: PRICING_CATALOG_VERSION,
    });
    expect(patch.status).toBe("ok");
    expect(patch.estimatedCostUsd).toBe("0.001200");
    expect(patch.pricingVersion).toBe(PRICING_CATALOG_VERSION);
  });

  it("bills empty text with usage as invalid_output", () => {
    const patch = buildSettledUsageFromCompletion(
      base({
        text: "   ",
        usage: {
          inputTokens: 1000,
          outputTokens: 10,
          cachedInputTokens: 200,
          reasoningTokens: 3,
        },
        model: "gpt-6.1-terra",
        providerResponseId: "resp_empty",
      }),
      { pricingVersion: PRICING_CATALOG_VERSION },
    );
    expect(patch.status).toBe("invalid_output");
    expect(patch.errorCode).toBe("empty_output_with_usage");
    expect(patch.providerResponseId).toBe("resp_empty");
    expect(patch.cachedInputTokens).toBe(200);
    expect(patch.reasoningTokens).toBe(3);
    expect(Number(patch.estimatedCostUsd)).toBeGreaterThan(0);
  });
});
