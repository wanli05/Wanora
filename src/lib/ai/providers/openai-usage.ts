import type { AiTokenUsage } from "@/lib/ai/types";

export type OpenAiUsageLike = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  input_tokens_details?: {
    cached_tokens?: number;
    cache_write_tokens?: number;
  };
  output_tokens_details?: {
    reasoning_tokens?: number;
  };
};

/** Map Responses `usage` → AiTokenUsage (reasoning is detail, not double-counted). */
export function mapOpenAiUsage(usage: OpenAiUsageLike | null | undefined): {
  mapped: AiTokenUsage;
  scrubbed: Record<string, unknown>;
} {
  const inputTokens = Math.max(0, Number(usage?.input_tokens ?? 0));
  const outputTokens = Math.max(0, Number(usage?.output_tokens ?? 0));
  const cachedInputTokens = Math.max(
    0,
    Number(usage?.input_tokens_details?.cached_tokens ?? 0),
  );
  const cacheWriteTokens = Math.max(
    0,
    Number(usage?.input_tokens_details?.cache_write_tokens ?? 0),
  );
  const reasoningTokens = Math.max(
    0,
    Number(usage?.output_tokens_details?.reasoning_tokens ?? 0),
  );
  const totalTokens = Math.max(
    0,
    Number(usage?.total_tokens ?? inputTokens + outputTokens),
  );

  const mapped: AiTokenUsage = {
    inputTokens,
    outputTokens,
    totalTokens,
  };
  if (cachedInputTokens > 0) mapped.cachedInputTokens = cachedInputTokens;
  if (cacheWriteTokens > 0) mapped.cacheWriteTokens = cacheWriteTokens;
  if (reasoningTokens > 0) mapped.reasoningTokens = reasoningTokens;

  const scrubbed: Record<string, unknown> = {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    cached_tokens: cachedInputTokens,
    cache_write_tokens: cacheWriteTokens,
    reasoning_tokens: reasoningTokens,
  };

  return { mapped, scrubbed };
}

export function usageLooksPresent(usage: AiTokenUsage): boolean {
  return (
    usage.inputTokens > 0 ||
    usage.outputTokens > 0 ||
    (usage.totalTokens ?? 0) > 0 ||
    (usage.cachedInputTokens ?? 0) > 0
  );
}
