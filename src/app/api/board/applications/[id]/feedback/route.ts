import { z } from "zod";
import { getDb } from "@/db";
import { loadBoard } from "@/lib/data/applications";
import {
  deleteInterviewFeedback,
  upsertInterviewFeedback,
} from "@/lib/data/interview-feedbacks";
import { FEEDBACK_SOURCES } from "@/lib/progress/enums";
import { progressResponse, requireUser, unauthorized } from "../../../http";

const upsertSchema = z
  .object({
    interviewId: z.uuid(),
    source: z.enum(FEEDBACK_SOURCES),
    body: z.string().nullable().optional(),
    rating: z.number().int().min(1).max(5).nullable().optional(),
    recordedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

const deleteSchema = z
  .object({
    interviewId: z.uuid(),
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
    const { interviewId, ...input } = parsed.data;
    await upsertInterviewFeedback(getDb(), user.id, interviewId, input);
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
    await deleteInterviewFeedback(getDb(), user.id, parsed.data.interviewId);
    return Response.json(await loadBoard(getDb(), user.id));
  } catch (error) {
    return progressResponse(error);
  }
}
