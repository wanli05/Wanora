import { z } from "zod";
import { getDb } from "@/db";
import { loadBoard } from "@/lib/data/applications";
import { createRecruiter } from "@/lib/data/recruiters";
import { progressResponse, requireUser, unauthorized } from "../http";

const schema = z
  .object({
    platformId: z.uuid(),
    name: z.string().trim().min(1),
    agency: z.string().trim().optional(),
    email: z.string().trim().optional(),
  })
  .strict();

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return unauthorized();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  try {
    const recruiter = await createRecruiter(getDb(), user.id, parsed.data);
    const board = await loadBoard(getDb(), user.id);
    return Response.json({ recruiter, ...board }, { status: 201 });
  } catch (error) {
    return progressResponse(error);
  }
}
