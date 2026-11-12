import { getDb } from "@/db";
import { loadBoard } from "@/lib/data/applications";
import {
  createInterviewFeedback,
  deleteInterviewFeedback,
  updateInterviewFeedback,
} from "@/lib/data/interview-feedbacks";
import {
  parseFeedbackDeleteBody,
  parseFeedbackUpsertBody,
} from "@/lib/progress/feedback-api";
import { progressResponse, requireUser, unauthorized } from "../../../http";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(request);
  if (!user) return unauthorized();
  await context.params;
  const parsed = parseFeedbackUpsertBody(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  try {
    const {
      interviewId,
      feedbackId,
      source,
      body = null,
      question = null,
      ownAnswer = null,
      resultText = null,
      reflection = null,
      recordedOn,
    } = parsed.data;
    const content = { source, body, question, ownAnswer, resultText, reflection, recordedOn };
    if (feedbackId) {
      await updateInterviewFeedback(getDb(), user.id, feedbackId, content);
    } else {
      await createInterviewFeedback(getDb(), user.id, interviewId, content);
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
  const parsed = parseFeedbackDeleteBody(await request.json().catch(() => null));
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
