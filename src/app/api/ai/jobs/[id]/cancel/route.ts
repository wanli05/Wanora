import { getDb } from "@/db";
import {
  aiError,
  notFound,
  requireAiUser,
  unauthorized,
} from "@/lib/ai/conversation/http";
import { cancelAiJob } from "@/lib/ai/jobs/cancel";
import { jobIdParamSchema, serializeAiJob } from "@/lib/ai/jobs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await requireAiUser(request);
  if (!user) return unauthorized();

  const { id: rawId } = await context.params;
  const idParsed = jobIdParamSchema.safeParse(rawId);
  if (!idParsed.success) {
    return aiError("invalid_params", 400, "invalid job id");
  }

  const result = await cancelAiJob(getDb(), user.id, idParsed.data);
  if (!result.ok) return notFound();

  return Response.json({
    job: serializeAiJob(result.job),
    alreadyTerminal: result.alreadyTerminal,
  });
}
