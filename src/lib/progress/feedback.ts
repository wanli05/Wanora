import type { FeedbackSource } from "./enums";
import { ProgressError } from "./errors";

export type FeedbackInput = {
  source: FeedbackSource;
  body: string;
  recordedOn: string;
};

export function canCreateFeedback(input: {
  interviewStatus: string;
  startsAt: string | Date;
  now?: Date;
}): boolean {
  if (input.interviewStatus !== "scheduled") return false;
  const start =
    input.startsAt instanceof Date
      ? input.startsAt
      : new Date(input.startsAt);
  const now = input.now ?? new Date();
  return start.getTime() <= now.getTime();
}

export function normalizeFeedbackBody(body: string | null | undefined): string {
  if (body === undefined || body === null) {
    throw new ProgressError("invalid", "body required");
  }
  const trimmed = body.trim();
  if (!trimmed) {
    throw new ProgressError("invalid", "body required");
  }
  return trimmed;
}

export function validateFeedbackContent(input: {
  body?: string | null;
}): { body: string } {
  return { body: normalizeFeedbackBody(input.body) };
}

export function feedbackSummary(input: {
  source: FeedbackSource;
  body: string | null;
}): string {
  const prefix =
    input.source === "company"
      ? "会社"
      : input.source === "recruiter"
        ? "エージェント"
        : "自分";
  const snippet = input.body?.trim() ?? "";
  if (!snippet) return prefix;
  const short = snippet.length > 18 ? `${snippet.slice(0, 18)}…` : snippet;
  return `${prefix} · ${short}`;
}
