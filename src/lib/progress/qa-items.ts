import type { FeedbackQaItem } from "@/db/schema";
import { normalizeOptionalText } from "./job-posting";

export type { FeedbackQaItem };

/** Normalize one Q&A block; drop fully empty rows. */
export function normalizeQaItem(
  item: { question?: string | null; answer?: string | null; tag?: string | null },
): FeedbackQaItem | null {
  const question = normalizeOptionalText(item.question);
  const answer = normalizeOptionalText(item.answer);
  const tag = normalizeOptionalText(item.tag);
  if (!question && !answer) return null;
  return { question, answer, ...(tag ? { tag } : {}) };
}

export function normalizeQaItems(
  items: Array<{ question?: string | null; answer?: string | null; tag?: string | null }> | null | undefined,
): FeedbackQaItem[] {
  if (!items?.length) return [];
  return items
    .map((item) => normalizeQaItem(item))
    .filter((item): item is FeedbackQaItem => item != null);
}

/**
 * Read path: prefer `qaItems`; if empty, fall back to legacy question/ownAnswer
 * so pre-migration rows keep showing in the new UI.
 */
export function resolveQaItems(input: {
  qaItems?: FeedbackQaItem[] | null;
  question?: string | null;
  ownAnswer?: string | null;
}): FeedbackQaItem[] {
  const fromJson = normalizeQaItems(input.qaItems);
  if (fromJson.length > 0) return fromJson;
  const legacy = normalizeQaItem({
    question: input.question,
    answer: input.ownAnswer,
  });
  return legacy ? [legacy] : [];
}

/**
 * Write path: store blocks in qaItems and mirror the first block into
 * legacy question/ownAnswer so old readers / rollback stay reversible.
 */
export function mirrorQaToLegacy(qaItems: FeedbackQaItem[]): {
  qaItems: FeedbackQaItem[];
  question: string | null;
  ownAnswer: string | null;
} {
  const normalized = normalizeQaItems(qaItems);
  const first = normalized[0];
  return {
    qaItems: normalized,
    question: first?.question ?? null,
    ownAnswer: first?.answer ?? null,
  };
}

export function qaItemsHaveContent(qaItems: FeedbackQaItem[]): boolean {
  return qaItems.some((item) => Boolean(item.question || item.answer));
}
