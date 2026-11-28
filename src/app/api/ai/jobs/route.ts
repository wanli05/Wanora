import { getDb } from "@/db";
import {
  aiError,
  requireAiUser,
  unauthorized,
} from "@/lib/ai/conversation/http";
import {
  enqueueAiJob,
  enqueueJobBodySchema,
  serializeAiJob,
} from "@/lib/ai/jobs";

export async function POST(request: Request) {
  const user = await requireAiUser(request);
  if (!user) return unauthorized();

  const parsed = enqueueJobBodySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return aiError("invalid_body", 400, "invalid body", parsed.error.flatten());
  }

  const body = parsed.data;
  const result = await enqueueAiJob(getDb(), {
    userId: user.id,
    conversationId: body.conversationId,
    clientRequestId: body.clientRequestId,
    content: body.content,
    feature: body.feature,
    pageContext: body.pageContext ?? null,
    targetContext: body.targetContext,
    model: body.model,
  });

  if (!result.ok) {
    switch (result.code) {
      case "ai_unavailable":
        return aiError("ai_unavailable", 503, result.message);
      case "not_found":
        return aiError("not_found", 404, result.message);
      case "rate_limited":
        return aiError("rate_limited", 429, result.message);
      case "budget_exceeded":
        return aiError("budget_exceeded", 429, result.message, result.detail);
      case "global_budget_exceeded":
        return aiError(
          "global_budget_exceeded",
          429,
          result.message,
          result.detail,
        );
      case "daily_limit_exceeded":
        return aiError(
          "daily_limit_exceeded",
          429,
          result.message,
          result.detail,
        );
      case "job_in_progress":
        return aiError("job_in_progress", 409, result.message, result.detail);
      case "invalid_request":
        return aiError("invalid_body", 400, result.message);
      default: {
        const _exhaustive: never = result.code;
        return _exhaustive;
      }
    }
  }

  return Response.json(
    {
      job: serializeAiJob(result.job),
      userMessageId: result.userMessage.id,
      replayed: result.replayed,
    },
    { status: result.replayed ? 200 : 202 },
  );
}
