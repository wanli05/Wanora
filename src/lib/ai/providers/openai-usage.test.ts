import { describe, expect, it } from "vitest";
import {
  mapOpenAiUsage,
  usageLooksPresent,
} from "@/lib/ai/providers/openai-usage";

describe("mapOpenAiUsage", () => {
  it("maps input/output and optional details without double-counting reasoning", () => {
    const { present, mapped, scrubbed } = mapOpenAiUsage({
      input_tokens: 100,
      output_tokens: 40,
      total_tokens: 140,
      input_tokens_details: { cached_tokens: 20, cache_write_tokens: 5 },
      output_tokens_details: { reasoning_tokens: 12 },
    });
    expect(present).toBe(true);
    expect(mapped).toEqual({
      inputTokens: 100,
      outputTokens: 40,
      totalTokens: 140,
      cachedInputTokens: 20,
      cacheWriteTokens: 5,
      reasoningTokens: 12,
    });
    expect(scrubbed.reasoning_tokens).toBe(12);
    expect(scrubbed.cache_write_tokens).toBe(5);
  });

  it("marks missing usage as present:false (unknown — not free)", () => {
    const result = mapOpenAiUsage(undefined);
    expect(result.present).toBe(false);
    expect(result.mapped.inputTokens).toBe(0);
    expect(usageLooksPresent(result.mapped)).toBe(false);
    expect(result.scrubbed.usage_present).toBe(false);
  });

  it("treats an explicit zero usage object as present", () => {
    const result = mapOpenAiUsage({
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    });
    expect(result.present).toBe(true);
    expect(usageLooksPresent(result.mapped)).toBe(false);
  });
});
