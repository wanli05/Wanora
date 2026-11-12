import { z } from "zod";
import { FEEDBACK_SOURCES } from "./enums";

/**
 * Body for PUT /feedback.
 * - No `.strict()`: stale clients may still send `rating` after we dropped it.
 * - `feedbackId` is nullish so append payloads with an explicit null still create.
 */
export const feedbackUpsertSchema = z.object({
  interviewId: z.uuid(),
  feedbackId: z.uuid().nullish(),
  source: z.enum(FEEDBACK_SOURCES),
  body: z.string().trim().min(1),
  recordedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const feedbackDeleteSchema = z.object({
  feedbackId: z.uuid(),
});

export function parseFeedbackUpsertBody(raw: unknown) {
  return feedbackUpsertSchema.safeParse(raw);
}

export function parseFeedbackDeleteBody(raw: unknown) {
  return feedbackDeleteSchema.safeParse(raw);
}
