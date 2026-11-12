import { z } from "zod";
import { getDb } from "@/db";
import { loadBoard } from "@/lib/data/applications";
import {
  createInterviewFeedback,
  deleteInterviewFeedback,
  updateInterviewFeedback,
} from "@/lib/data/interview-feedbacks";
import { FEEDBACK_SOURCES } from "@/lib/progress/enums";
import { progressResponse, requireUser, unauthorized } from "../../../http";

const upsertSchema = z
  .object({
    interviewId: z.uuid(),
    feedbackId: z.uuid().optional(),
    source: z.enum(FEEDBACK_SOURCES),
    body: z.string().trim().min(1),
    recordedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

const deleteSchema = z
  .object({
    feedbackId: z.uuid(),
  })
  .strict();

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(request);
  if (!user) return unauthorized();
  await context.params;
  const parsed = upsertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  try {
    const { interviewId, feedbackId, ...input } = parsed.data;
    if (feedbackId) {
      await updateInterviewFeedback(getDb(), user.id, feedbackId, input);
    } else {
      await createInterviewFeedback(getDb(), user.id, interviewId, input);
    }
    return Response.json(await loadBoard(getDb(), user.id));
  } catch (error) {
    return progressResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(request);
  if (!user) return unauthorized();
  await context.params;
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  try {
    await deleteInterviewFeedback(getDb(), user.id, parsed.data.feedbackId);
    return Response.json(await loadBoard(getDb(), user.id));
  } catch (error) {
    return progressResponse(error);
  }
}
