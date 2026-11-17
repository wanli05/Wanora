import type { AiChatMessage } from "@/lib/ai/types";
import {
  PRICING_CATALOG_VERSION,
} from "@/lib/ai/pricing/catalog";
import { estimateCostUsd } from "@/lib/ai/pricing/estimate";
import { estimateTokensFromMessages } from "@/lib/ai/prompt-build";

/** Default max-output headroom when caller does not pass env.AI_OPENAI_MAX_OUTPUT_TOKENS. */
export const DEFAULT_RESERVE_MAX_OUTPUT_TOKENS = 2048;

export type ReserveEstimate = {
  estimatedTokens: number;
  estimatedCostUsd: string;
  pricingVersion: string;
  model: string;
  /** Prediction only — character/heuristic estimate, not a tokenizer hard cap. */
  inputTokensEstimate: number;
  outputTokensReserved: number;
  toctouSlackTokens: number;
};

/**
 * Conservative pre-call reservation from the same message list execute will send
 * (plus max output headroom and TOCTOU slack for context growth enqueue→execute).
 *
 * Pure: does not read process.env / getServerEnv. Callers should pass
 * `maxOutputTokens` / `pricingVersion` from ServerEnv when available.
 */
export function estimateReservation(args: {
  messages: AiChatMessage[];
  model: string;
  maxOutputTokens?: number;
  pricingVersion?: string;
}): ReserveEstimate {
  const model = args.model;
  const pricingVersion = args.pricingVersion ?? PRICING_CATALOG_VERSION;
  const maxOut = args.maxOutputTokens ?? DEFAULT_RESERVE_MAX_OUTPUT_TOKENS;

  const inputTokensEstimate = estimateTokensFromMessages(args.messages);
  // Context / history may grow between enqueue and execute — pad conservatively.
  const toctouSlackTokens = Math.max(
    256,
    Math.ceil(inputTokensEstimate * 0.1),
  );
  const estimatedTokens = inputTokensEstimate + maxOut + toctouSlackTokens;

  // Price as ordinary input + full output headroom (no cache credit) — upper bound.
  const priced = estimateCostUsd({
    model,
    pricingVersion,
    usage: {
      inputTokens: inputTokensEstimate + toctouSlackTokens,
      outputTokens: maxOut,
    },
  });

  return {
    estimatedTokens,
    estimatedCostUsd: priced.estimatedCostUsd,
    pricingVersion: priced.pricingVersion,
    model,
    inputTokensEstimate,
    outputTokensReserved: maxOut,
    toctouSlackTokens,
  };
}
