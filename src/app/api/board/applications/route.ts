import { z } from "zod";
import { getDb } from "@/db";
import { createApplication, loadBoard } from "@/lib/data/applications";
import { progressResponse, requireUser, unauthorized } from "../http";

const schema = z
  .object({
    company: z.string().trim().min(1),
    role: z.string().trim().optional(),
    platformId: z.uuid().optional(),
    customPlatformName: z.string().trim().min(1).nullable().optional(),
    recruiterId: z.uuid().nullable().optional(),
    recruiterName: z.string().trim().nullable().optional(),
    appliedOn: z.string().optional(),
    includeInfoSession: z.boolean().optional(),
    includeSecondInterview: z.boolean().optional(),
    skipAptitude: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => Boolean(value.platformId) || Boolean(value.customPlatformName?.trim()),
    { message: "platform required" },
  );

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return unauthorized();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  try {
    await createApplication(getDb(), user.id, parsed.data);
    return Response.json(await loadBoard(getDb(), user.id), { status: 201 });
  } catch (error) {
    return progressResponse(error);
  }
}
