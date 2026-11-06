import { z } from "zod";
import { getDb } from "@/db";
import { loadBoard } from "@/lib/data/applications";
import { createInterview, updateInterview } from "@/lib/data/schedule";
import { INTERVIEW_MODES } from "@/lib/progress/enums";
import { progressResponse, requireUser, unauthorized } from "../../../http";

const schema = z
  .object({
    interviewId: z.uuid().optional(),
    start: z.string().min(1),
    end: z.string().min(1),
    mode: z.enum(INTERVIEW_MODES),
    meetingUrl: z.string().optional(),
    locationText: z.string().optional(),
  })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(request);
  if (!user) return unauthorized();
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  try {
    const result = parsed.data.interviewId
      ? await updateInterview(getDb(), user.id, id, parsed.data.interviewId, parsed.data)
      : await createInterview(getDb(), user.id, id, parsed.data);
    const board = await loadBoard(getDb(), user.id);
    return Response.json(
      { ...board, released: result.released },
      { status: parsed.data.interviewId ? 200 : 201 },
    );
  } catch (error) {
    return progressResponse(error);
  }
}
