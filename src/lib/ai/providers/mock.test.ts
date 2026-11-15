import { describe, expect, it } from "vitest";
import {
  createMockAiProvider,
  mockEstimatedCostUsd,
} from "@/lib/ai/providers/mock";

describe("createMockAiProvider", () => {
  it("returns deterministic Japanese mock text without network", async () => {
    const provider = createMockAiProvider();
    expect(provider.id).toBe("mock");

    const result = await provider.complete({
      feature: "chat",
      messages: [{ role: "user", content: "職務要約を改善して" }],
    });

    expect(result.provider).toBe("mock");
    expect(result.model).toBe("mock-v1");
    expect(result.text).toContain("【モック応答】");
    expect(result.text).toContain("職務要約を改善して");
    expect(result.usage.inputTokens).toBeGreaterThan(0);
    expect(result.usage.outputTokens).toBeGreaterThan(0);
    expect(result.latencyMs).toBeGreaterThan(0);
  });

  it("honors an explicit model override", async () => {
    const result = await createMockAiProvider().complete({
      feature: "chat",
      model: "mock-custom",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(result.model).toBe("mock-custom");
  });
});

describe("mockEstimatedCostUsd", () => {
  it("scales linearly with tokens", () => {
    expect(mockEstimatedCostUsd(0)).toBe("0.000000");
    expect(mockEstimatedCostUsd(100)).toBe("0.001000");
  });
});
