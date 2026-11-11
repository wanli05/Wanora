import type { FeedbackSource } from "./enums";
import { ProgressError } from "./errors";

export type FeedbackInput = {
  source: FeedbackSource;
  body?: string | null;
  rating?: number | null;
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

export function normalizeFeedbackBody(body: string | null | undefined): string | null {
  if (body === undefined || body === null) return null;
  const trimmed = body.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function validateFeedbackContent(input: {
  body?: string | null;
  rating?: number | null;
}): { body: string | null; rating: number | null } {
  const body = normalizeFeedbackBody(input.body);
  const rating =
    input.rating === undefined || input.rating === null
      ? null
      : input.rating;
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    throw new ProgressError("invalid", "rating must be 1–5");
  }
  if (body === null && rating === null) {
    throw new ProgressError("invalid", "body or rating required");
  }
  return { body, rating };
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
