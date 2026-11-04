import { z } from "zod";
import { getDb } from "@/db";
import { loadBoard } from "@/lib/data/applications";
import { confirmProposedSlot, saveSlotProposal } from "@/lib/data/schedule";
import { INTERVIEW_MODES } from "@/lib/progress/enums";
import { progressResponse, requireUser, unauthorized } from "../../../http";

const saveSchema = z
  .object({
    slots: z.array(z.object({ start: z.string(), end: z.string() })).min(1),
    status: z.enum(["draft", "sent"]),
    replyDeadlineAt: z.string().nullable().optional(),
  })
  .strict();

const confirmSchema = z
  .object({
    confirmSlotId: z.uuid(),
    mode: z.enum(INTERVIEW_MODES).optional(),
    meetingUrl: z.string().optional(),
  })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(request);
  if (!user) return unauthorized();
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const confirm = confirmSchema.safeParse(body);
  if (confirm.success) {
    try {
      const result = await confirmProposedSlot(
        getDb(),
        user.id,
        id,
        confirm.data.confirmSlotId,
        confirm.data,
      );
      const board = await loadBoard(getDb(), user.id);
      return Response.json({ ...board, released: result.released });
    } catch (error) {
      return progressResponse(error);
    }
  }
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  try {
    await saveSlotProposal(getDb(), user.id, id, parsed.data);
    return Response.json(await loadBoard(getDb(), user.id), { status: 201 });
  } catch (error) {
    return progressResponse(error);
  }
}
