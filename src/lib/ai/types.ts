export type AiChatRole = "system" | "user" | "assistant";

export type AiChatMessage = {
  role: AiChatRole;
  content: string;
};

export type AiCompletionRequest = {
  feature: string;
  model?: string;
  messages: AiChatMessage[];
};

export type AiTokenUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type AiCompletionResult = {
  text: string;
  usage: AiTokenUsage;
  provider: string;
  model: string;
  latencyMs: number;
};

/** Unified provider contract — only mock is implemented in Phase 1A. */
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
