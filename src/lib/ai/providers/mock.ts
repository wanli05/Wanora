import type {
  AiCompletionRequest,
  AiCompletionResult,
  AiProvider,
} from "@/lib/ai/types";
import { estimateCostUsd } from "@/lib/ai/pricing/estimate";

const MOCK_MODEL = "mock-v1";

function estimateTokens(text: string): number {
  // Rough CJK-friendly estimate: ~1 token per 2 chars, min 1 when non-empty.
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 2));
}

/**
 * Deterministic mock provider — no network. Safe for CI and local without keys.
 */
export function createMockAiProvider(): AiProvider {
  return {
    id: "mock",
    async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
      if (request.signal?.aborted) {
        const err = new Error("aborted");
        err.name = "AbortError";
        throw err;
      }
      const started = Date.now();
      const inputText = request.messages.map((m) => m.content).join("\n");
      const lastUser = [...request.messages]
        .reverse()
        .find((m) => m.role === "user");
      const snippet = (lastUser?.content ?? "").trim().slice(0, 80);
      const text = snippet
        ? `【モック応答】ご入力を受け取りました：${snippet}`
        : "【モック応答】メッセージを入力してください。";

      const inputTokens = estimateTokens(inputText);
      const outputTokens = estimateTokens(text);
      const latencyMs = Math.max(1, Date.now() - started);

      return {
        text,
        usage: { inputTokens, outputTokens },
        provider: "mock",
        model: request.model?.trim() || MOCK_MODEL,
        latencyMs,
      };
    },
  };
}

/**
 * Legacy helper: treat `tokens` as ordinary input on mock-v1 ($10 / 1M).
 * Prefer estimateCostUsd for new code paths.
 */
export function mockEstimatedCostUsd(tokens: number): string {
  return estimateCostUsd({
    model: MOCK_MODEL,
    usage: { inputTokens: tokens, outputTokens: 0 },
  }).estimatedCostUsd;
}
