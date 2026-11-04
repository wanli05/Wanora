import { z } from "zod";
import { getDb } from "@/db";
import {
  advanceApplication,
  loadBoard,
  updateApplicationNote,
} from "@/lib/data/applications";
import { progressResponse, requireUser, unauthorized } from "../../http";

const schema = z
  .object({
    action: z
      .enum([
        "pass",
        "skip",
        "reject",
        "withdraw",
        "offer",
        "accept_offer",
        "decline_offer",
        "reopen",
      ])
      .optional(),
    nextPrepNote: z.string().nullable().optional(),
  })
  .strict();

export async function PATCH(
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
    if (parsed.data.action) {
      await advanceApplication(getDb(), user.id, id, parsed.data.action);
    }
    if (parsed.data.nextPrepNote !== undefined) {
      await updateApplicationNote(getDb(), user.id, id, parsed.data.nextPrepNote);
    }
    return Response.json(await loadBoard(getDb(), user.id));
  } catch (error) {
    return progressResponse(error);
  }
}
