import { z } from "zod";
import { FEEDBACK_SOURCES } from "./enums";

const optionalTrimmed = z
  .string()
  .nullish()
  .transform((value) => {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

/**
 * Body for PUT /feedback.
 * - No `.strict()`: stale clients may still send `rating` after we dropped it.
 * - `feedbackId` is nullish so append payloads with an explicit null still create.
 * - At least one of body / question / ownAnswer / resultText / reflection required.
 */
export const feedbackUpsertSchema = z
  .object({
    interviewId: z.uuid(),
    feedbackId: z.uuid().nullish(),
    source: z.enum(FEEDBACK_SOURCES),
    body: optionalTrimmed,
    question: optionalTrimmed,
    ownAnswer: optionalTrimmed,
    resultText: optionalTrimmed,
    reflection: optionalTrimmed,
    recordedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .superRefine((value, ctx) => {
    if (
      !value.body &&
      !value.question &&
      !value.ownAnswer &&
      !value.resultText &&
      !value.reflection
    ) {
      ctx.addIssue({
        code: "custom",
        message: "feedback content required",
        path: ["body"],
      });
    }
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
