import type { FeedbackQaItem } from "@/db/schema";
import type { FeedbackSource } from "./enums";
import { ProgressError } from "./errors";
import { normalizeOptionalText } from "./job-posting";
import {
  mirrorQaToLegacy,
  normalizeQaItems,
  qaItemsHaveContent,
  resolveQaItems,
} from "./qa-items";

export type FeedbackStructuredFields = {
  body: string | null;
  question: string | null;
  ownAnswer: string | null;
  qaItems: FeedbackQaItem[];
  resultText: string | null;
  reflection: string | null;
};

export type FeedbackInput = {
  source: FeedbackSource;
  recordedOn: string;
  body?: string | null;
  question?: string | null;
  ownAnswer?: string | null;
  qaItems?: FeedbackQaItem[] | null;
  resultText?: string | null;
  reflection?: string | null;
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

export function normalizeFeedbackField(
  value: string | null | undefined,
): string | null {
  return normalizeOptionalText(value);
}

export function validateFeedbackContent(input: {
  body?: string | null;
  question?: string | null;
  ownAnswer?: string | null;
  qaItems?: FeedbackQaItem[] | null;
  resultText?: string | null;
  reflection?: string | null;
}): FeedbackStructuredFields {
  const mirrored = mirrorQaToLegacy(
    input.qaItems != null && input.qaItems.length > 0
      ? normalizeQaItems(input.qaItems)
      : resolveQaItems({
          qaItems: input.qaItems,
          question: input.question,
          ownAnswer: input.ownAnswer,
        }),
  );
  const fields: FeedbackStructuredFields = {
    body: normalizeFeedbackField(input.body),
    question: mirrored.question,
    ownAnswer: mirrored.ownAnswer,
    qaItems: mirrored.qaItems,
    resultText: normalizeFeedbackField(input.resultText),
    reflection: normalizeFeedbackField(input.reflection),
  };
  if (
    !fields.body &&
    !fields.question &&
    !fields.ownAnswer &&
    !fields.resultText &&
    !fields.reflection &&
    !qaItemsHaveContent(fields.qaItems)
  ) {
    throw new ProgressError("invalid", "feedback content required");
  }
  return fields;
}

function firstSnippet(fields: FeedbackStructuredFields): string {
  const firstQa = fields.qaItems[0];
  return (
    fields.body ??
    firstQa?.question ??
    firstQa?.answer ??
    fields.question ??
    fields.ownAnswer ??
    fields.resultText ??
    fields.reflection ??
    ""
  );
}

export function feedbackSummary(input: {
  source: FeedbackSource;
  body?: string | null;
  question?: string | null;
  ownAnswer?: string | null;
  qaItems?: FeedbackQaItem[] | null;
  resultText?: string | null;
  reflection?: string | null;
}): string {
  const prefix =
    input.source === "company"
      ? "会社"
      : input.source === "recruiter"
        ? "エージェント"
        : "自分";
  const resolved = resolveQaItems({
    qaItems: input.qaItems,
    question: input.question,
    ownAnswer: input.ownAnswer,
  });
  const snippet = firstSnippet({
    body: normalizeFeedbackField(input.body),
    question: normalizeFeedbackField(input.question),
    ownAnswer: normalizeFeedbackField(input.ownAnswer),
    qaItems: resolved,
    resultText: normalizeFeedbackField(input.resultText),
    reflection: normalizeFeedbackField(input.reflection),
  });
  if (!snippet) return prefix;
  const short = snippet.length > 18 ? `${snippet.slice(0, 18)}…` : snippet;
  return `${prefix} · ${short}`;
}
