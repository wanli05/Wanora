import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { interviewFeedbacks, interviews } from "@/db/schema";
import {
  canCreateFeedback,
  validateFeedbackContent,
  type FeedbackInput,
} from "@/lib/progress/feedback";
import type { FeedbackSource } from "@/lib/progress/enums";
import { ProgressError } from "@/lib/progress/errors";
import { tokyoTodayKey } from "@/lib/progress/tokyo";

async function getOwnedInterview(db: Db, userId: string, interviewId: string) {
  const [row] = await db
    .select()
    .from(interviews)
    .where(and(eq(interviews.id, interviewId), eq(interviews.userId, userId)));
  if (!row) throw new ProgressError("not_found", "interview not found");
  return row;
}

async function getOwnedFeedback(db: Db, userId: string, feedbackId: string) {
  const [row] = await db
    .select()
    .from(interviewFeedbacks)
    .where(
      and(eq(interviewFeedbacks.id, feedbackId), eq(interviewFeedbacks.userId, userId)),
    );
  if (!row) throw new ProgressError("not_found", "feedback not found");
  return row;
}

export async function createInterviewFeedback(
  db: Db,
  userId: string,
  interviewId: string,
  input: FeedbackInput,
) {
  const interview = await getOwnedInterview(db, userId, interviewId);
  if (
    !canCreateFeedback({
      interviewStatus: interview.status,
      startsAt: interview.startsAt,
    })
  ) {
    throw new ProgressError(
      "invalid",
      "feedback can only be created after the interview starts",
    );
  }

  const content = validateFeedbackContent(input);
  const recordedOn = input.recordedOn || tokyoTodayKey();
  const source = input.source as FeedbackSource;

  const [created] = await db
    .insert(interviewFeedbacks)
    .values({
      userId,
      interviewId,
      source,
      ...content,
      recordedOn,
    })
    .returning();
  return created;
}

export async function updateInterviewFeedback(
  db: Db,
  userId: string,
  feedbackId: string,
  input: FeedbackInput,
) {
  const existing = await getOwnedFeedback(db, userId, feedbackId);
  const interview = await getOwnedInterview(db, userId, existing.interviewId);
  if (interview.status === "cancelled") {
    throw new ProgressError("invalid", "cancelled interview feedback is read-only");
  }

  const content = validateFeedbackContent(input);
  const recordedOn = input.recordedOn || tokyoTodayKey();
  const source = input.source as FeedbackSource;

  const [updated] = await db
    .update(interviewFeedbacks)
    .set({
      source,
      ...content,
      recordedOn,
    })
    .where(
      and(
        eq(interviewFeedbacks.id, existing.id),
        eq(interviewFeedbacks.userId, userId),
      ),
    )
    .returning();
  return updated;
}

export async function deleteInterviewFeedback(
  db: Db,
  userId: string,
  feedbackId: string,
) {
  await getOwnedFeedback(db, userId, feedbackId);
  await db
    .delete(interviewFeedbacks)
    .where(
      and(
        eq(interviewFeedbacks.id, feedbackId),
        eq(interviewFeedbacks.userId, userId),
      ),
    );
}
