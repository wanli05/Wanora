import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRICING_CATALOG,
  PRICING_CATALOG_VERSION,
} from "@/lib/ai/pricing/catalog";
import { estimateCostUsd } from "@/lib/ai/pricing/estimate";
import { microsToUsd, usdToMicros } from "@/lib/ai/pricing/money";

describe("estimateCostUsd / money", () => {
  it("prices ordinary input + output without float drift", () => {
    // gpt-6.1-terra: $1 / $5 per 1M → 1_000_000 in + 100_000 out = $1 + $0.5
    const r = estimateCostUsd({
      model: "gpt-6.1-terra",
      usage: { inputTokens: 1_000_000, outputTokens: 100_000 },
    });
    expect(r.estimatedCostUsd).toBe("1.500000");
    expect(r.pricingVersion).toBe(PRICING_CATALOG_VERSION);
    expect(usdToMicros(r.estimatedCostUsd)).toBe(BigInt(1_500_000));
  });

  it("prices cached input cheaper and does not double-count reasoning", () => {
    // 1000 input of which 400 cached; 200 output of which 50 reasoning (subset)
    const r = estimateCostUsd({
      model: "gpt-6.1-terra",
      usage: {
        inputTokens: 1000,
        cachedInputTokens: 400,
        outputTokens: 200,
        reasoningTokens: 50,
      },
    });
    // ordinary 600 * $1/M + cached 400 * $0.05/M + output 200 * $5/M
    // = 0.000600 + 0.000020 + 0.001000 = 0.001620
    expect(r.estimatedCostUsd).toBe("0.001620");
    // reasoning must not add extra micros
    expect(r.breakdownMicros.output).toBe(usdToMicros("0.001000"));
  });

  it("rejects unknown models instead of zero-cost", () => {
    expect(() =>
      estimateCostUsd({
        model: "totally-unknown-model",
        usage: { inputTokens: 10, outputTokens: 10 },
      }),
    ).toThrow(/unknown_model_pricing/);
  });

  it("rejects pricing version mismatch", () => {
    expect(() =>
      estimateCostUsd({
        model: "mock-v1",
        pricingVersion: "not-a-real-version",
        usage: { inputTokens: 1, outputTokens: 0 },
        catalog: DEFAULT_PRICING_CATALOG,
      }),
    ).toThrow(/pricing_version_mismatch/);
  });

  it("keeps mock-v1 compatible with legacy $0.00001/token", () => {
    const r = estimateCostUsd({
      model: "mock-v1",
      usage: { inputTokens: 100, outputTokens: 0 },
    });
    expect(r.estimatedCostUsd).toBe("0.001000");
    expect(microsToUsd(BigInt(1000))).toBe("0.001000");
  });
});
