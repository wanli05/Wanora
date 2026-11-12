import { z } from "zod";
import { getDb } from "@/db";
import {
  advanceApplication,
  deleteApplication,
  loadBoard,
  updateApplication,
} from "@/lib/data/applications";
import { progressResponse, requireUser, unauthorized } from "../../http";

const optionalText = z.string().nullable().optional();

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
        "undo",
      ])
      .optional(),
    nextPrepNote: optionalText,
    company: z.string().trim().min(1).optional(),
    role: z.string().trim().nullable().optional(),
    platformId: z.uuid().optional(),
    customPlatformName: z.string().trim().min(1).nullable().optional(),
    recruiterId: z.uuid().nullable().optional(),
    recruiterName: z.string().trim().nullable().optional(),
    appliedOn: z.string().optional(),
    companyUrl: optionalText,
    companyNotes: optionalText,
    jobUrl: optionalText,
    salaryBandText: optionalText,
    benefitsText: optionalText,
    jdText: optionalText,
    processNotes: optionalText,
    workLocationText: optionalText,
    jobNotes: optionalText,
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
    const { action, ...fields } = parsed.data;
    if (action) {
      await advanceApplication(getDb(), user.id, id, action);
    }
    if (Object.values(fields).some((value) => value !== undefined)) {
      await updateApplication(getDb(), user.id, id, fields);
    }
    return Response.json(await loadBoard(getDb(), user.id));
  } catch (error) {
    return progressResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(_request);
  if (!user) return unauthorized();
  const { id } = await context.params;
  try {
    await deleteApplication(getDb(), user.id, id);
    return Response.json(await loadBoard(getDb(), user.id));
  } catch (error) {
    return progressResponse(error);
  }
}
