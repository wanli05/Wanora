import { describe, expect, it } from "vitest";
import { PRICING_CATALOG_VERSION } from "@/lib/ai/pricing/catalog";
import { estimateReservation } from "@/lib/ai/pricing/reserve";
import { B1_SYSTEM_INSTRUCTIONS } from "@/lib/ai/prompts/b1-system";

describe("estimateReservation", () => {
  it("covers system + context + history + user + output + TOCTOU slack", () => {
    const messages = [
      { role: "system" as const, content: B1_SYSTEM_INSTRUCTIONS },
      {
        role: "system" as const,
        content: "【参照コンテキスト】\n### profile\n長い職歴テキスト".repeat(20),
      },
      { role: "user" as const, content: "前回の質問" },
      { role: "assistant" as const, content: "前回の回答" },
      { role: "user" as const, content: "今回の質問です" },
    ];
    const r = estimateReservation({
      messages,
      model: "mock-v1",
      maxOutputTokens: 128,
      pricingVersion: PRICING_CATALOG_VERSION,
    });
    expect(r.inputTokensEstimate).toBeGreaterThan(50);
    expect(r.outputTokensReserved).toBe(128);
    expect(r.toctouSlackTokens).toBeGreaterThanOrEqual(256);
    expect(r.estimatedTokens).toBe(
      r.inputTokensEstimate + r.outputTokensReserved + r.toctouSlackTokens,
    );
    expect(Number(r.estimatedCostUsd)).toBeGreaterThan(0);
    expect(r.pricingVersion).toBe(PRICING_CATALOG_VERSION);
  });
});
