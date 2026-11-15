import { getDb } from "@/db";
import {
  aiError,
  notFound,
  requireAiUser,
  unauthorized,
} from "@/lib/ai/conversation/http";
import { jobIdParamSchema, serializeAiJob } from "@/lib/ai/jobs";
import { getAiJob } from "@/lib/data/ai-jobs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const user = await requireAiUser(request);
  if (!user) return unauthorized();

  const { id: rawId } = await context.params;
  const idParsed = jobIdParamSchema.safeParse(rawId);
  if (!idParsed.success) {
    return aiError("invalid_params", 400, "invalid job id");
  }

  const job = await getAiJob(getDb(), user.id, idParsed.data);
  if (!job) return notFound();

  return Response.json({ job: serializeAiJob(job) });
}
