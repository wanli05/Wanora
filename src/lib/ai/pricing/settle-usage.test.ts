import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildSettledUsageFromCompletion } from "@/lib/ai/pricing/settle-usage";
import { resetServerEnvCache } from "@/lib/env";
import type { AiCompletionResult } from "@/lib/ai/types";

beforeEach(() => {
  process.env.AI_PRICING_VERSION = "2026-11-17";
  resetServerEnvCache();
});

afterEach(() => {
  delete process.env.AI_PRICING_VERSION;
  resetServerEnvCache();
});

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
    const patch = buildSettledUsageFromCompletion(base({}));
    expect(patch.status).toBe("ok");
    expect(patch.estimatedCostUsd).toBe("0.001200");
    expect(patch.pricingVersion).toBe("2026-11-17");
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
    );
    expect(patch.status).toBe("invalid_output");
    expect(patch.errorCode).toBe("empty_output_with_usage");
    expect(patch.providerResponseId).toBe("resp_empty");
    expect(patch.cachedInputTokens).toBe(200);
    expect(patch.reasoningTokens).toBe(3);
    expect(Number(patch.estimatedCostUsd)).toBeGreaterThan(0);
  });
});
