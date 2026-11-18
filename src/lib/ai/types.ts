export type AiChatRole = "system" | "user" | "assistant";

export type AiChatMessage = {
  role: AiChatRole;
  content: string;
};

export type AiCompletionRequest = {
  feature: string;
  model?: string;
  messages: AiChatMessage[];
  /** Abort / worker stop / hard timeout — real providers must honor this. */
  signal?: AbortSignal;
  /** Optional idempotency / audit hint (e.g. job id). */
  requestKey?: string;
};

export type AiTokenUsage = {
  inputTokens: number;
  outputTokens: number;
  /** Present when the provider reports cache hits. */
  cachedInputTokens?: number;
  /** Cache write tokens when reported (priced separately when catalog has a rate). */
  cacheWriteTokens?: number;
  /** Detail within output tokens; do not add again to totals. */
  reasoningTokens?: number;
  totalTokens?: number;
};

export type AiCompletionResult = {
  text: string;
  usage: AiTokenUsage;
  provider: string;
  model: string;
  latencyMs: number;
  providerResponseId?: string;
  /** Scrubbed numeric usage only — never message content or secrets. */
  rawUsage?: Record<string, unknown>;
  /**
   * When set, Job must not treat `text` as a successful assistant reply.
   * Usage (if present) is still settled via the invalid_output / billed path —
   * never forged as a clean failure that zeroes known provider cost.
   */
  rejectReason?: "incomplete";
};

/** Unified provider contract — mock (1A) + openai (1B B1a). */
export interface AiProvider {
  readonly id: string;
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
}

export type AiGuardRejectCode =
  | "ai_unavailable"
  | "rate_limited"
  | "budget_exceeded"
  | "duplicate_request"
  | "invalid_request";

export type AiGuardSuccess = {
  ok: true;
  result: AiCompletionResult;
  usageEventId: string;
  /** True when the same requestId already completed successfully. */
  replayed?: boolean;
};

export type AiGuardFailure = {
  ok: false;
  code: AiGuardRejectCode;
  message: string;
  usageEventId?: string;
  detail?: string;
};

export type AiGuardOutcome = AiGuardSuccess | AiGuardFailure;
