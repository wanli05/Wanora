import { getDb } from "@/db";
import { chatBodySchema, runMockChat } from "@/lib/ai/chat";
import {
  aiError,
  requireAiUser,
  serializeConversation,
  serializeMessage,
  unauthorized,
  type AiApiErrorCode,
} from "@/lib/ai/conversation";
function mapFailureStatus(code: string): number {
  switch (code) {
    case "not_found":
      return 404;
    case "conversation_archived":
      return 409;
    case "ai_unavailable":
      return 503;
    case "rate_limited":
    case "budget_exceeded":
      return 429;
    case "duplicate_request":
      return 409;
    case "provider_error":
      return 502;
    case "invalid_request":
      return 400;
    default:
      return 400;
  }
}

export async function POST(request: Request) {
  const user = await requireAiUser(request);
  if (!user) return unauthorized();

  const parsed = chatBodySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return aiError("invalid_body", 400, "invalid body", parsed.error.flatten());
  }

  const result = await runMockChat(getDb(), {
    userId: user.id,
    ...parsed.data,
  });

  if (!result.ok) {
    return aiError(
      result.code as AiApiErrorCode,
      mapFailureStatus(result.code),
      result.message,
      result.detail ? { detail: result.detail, usageEventId: result.usageEventId } : undefined,
    );
  }

  return Response.json({
    replayed: result.replayed,
    conversation: serializeConversation(result.conversation),
    messages: {
      user: serializeMessage(result.userMessage),
      assistant: serializeMessage(result.assistantMessage),
    },
    usage: {
      usageEventId: result.usageEventId || null,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
    },
  });
}
