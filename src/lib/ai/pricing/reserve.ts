import type { AiChatMessage } from "@/lib/ai/types";
import { estimateCostUsd } from "@/lib/ai/pricing/estimate";
import {
  estimateTokensFromMessages,
} from "@/lib/ai/prompt-build";
import { getServerEnv } from "@/lib/env";

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
 */
export function estimateReservation(args: {
  messages: AiChatMessage[];
  model: string;
  maxOutputTokens?: number;
  pricingVersion?: string;
}): ReserveEstimate {
  const env = getServerEnv();
  const model = args.model;
  const pricingVersion = args.pricingVersion ?? env.AI_PRICING_VERSION;
  const maxOut =
    args.maxOutputTokens ?? env.AI_OPENAI_MAX_OUTPUT_TOKENS;

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
