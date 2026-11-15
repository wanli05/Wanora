import type { AiJobRow } from "@/lib/data/ai-jobs";

export type AiJobDto = {
  id: string;
  conversationId: string;
  clientRequestId: string;
  feature: string;
  status: string;
  attempt: number;
  maxAttempts: number;
  executionPhase: string;
  providerOutcome: string;
  errorCode: string | null;
  errorMessage: string | null;
  userMessageId: string | null;
  resultMessageId: string | null;
  usageEventId: string | null;
  provider: string | null;
  model: string | null;
  fencingToken: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  cancelRequestedAt: string | null;
};

export function serializeAiJob(row: AiJobRow): AiJobDto {
  return {
    id: row.id,
    conversationId: row.conversationId,
    clientRequestId: row.clientRequestId,
    feature: row.feature,
    status: row.status,
    attempt: row.attempt,
    maxAttempts: row.maxAttempts,
    executionPhase: row.executionPhase,
    providerOutcome: row.providerOutcome,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    userMessageId: row.userMessageId,
    resultMessageId: row.resultMessageId,
    usageEventId: row.usageEventId,
    provider: row.provider,
    model: row.model,
    fencingToken: Number(row.fencingToken),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    cancelRequestedAt: row.cancelRequestedAt
      ? row.cancelRequestedAt.toISOString()
      : null,
  };
}
