import { describe, expect, it } from "vitest";
import {
  mapOpenAiUsage,
  usageLooksPresent,
} from "@/lib/ai/providers/openai-usage";

describe("mapOpenAiUsage", () => {
  it("maps input/output and optional details without double-counting reasoning", () => {
    const { mapped, scrubbed } = mapOpenAiUsage({
      input_tokens: 100,
      output_tokens: 40,
      total_tokens: 140,
      input_tokens_details: { cached_tokens: 20, cache_write_tokens: 5 },
      output_tokens_details: { reasoning_tokens: 12 },
    });
    expect(mapped).toEqual({
      inputTokens: 100,
      outputTokens: 40,
      totalTokens: 140,
      cachedInputTokens: 20,
      reasoningTokens: 12,
    });
    expect(scrubbed.reasoning_tokens).toBe(12);
    expect(scrubbed.cache_write_tokens).toBe(5);
  });

  it("handles missing usage as zeros", () => {
    const { mapped } = mapOpenAiUsage(undefined);
    expect(mapped.inputTokens).toBe(0);
    expect(mapped.outputTokens).toBe(0);
    expect(usageLooksPresent(mapped)).toBe(false);
  });
});
