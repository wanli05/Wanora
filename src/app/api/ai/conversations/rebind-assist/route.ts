import { getDb } from "@/db";
import {
  aiError,
  rebindAssistConversationBodySchema,
  requireAiUser,
  serializeConversation,
  unauthorized,
} from "@/lib/ai/conversation";
import { rebindAssistConversations } from "@/lib/ai/conversation/rebind-assist";

export async function POST(request: Request) {
  const user = await requireAiUser(request);
  if (!user) return unauthorized();

  const parsed = rebindAssistConversationBodySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return aiError("invalid_body", 400, "invalid body", parsed.error.flatten());
  }

  const result = await rebindAssistConversations(getDb(), {
    userId: user.id,
    fromAssistSlotKey: parsed.data.fromAssistSlotKey,
    toAssistSlotKey: parsed.data.toAssistSlotKey,
    pinnedTarget: parsed.data.pinnedTarget,
  });

  if (!result.ok) {
    if (result.code === "not_found") {
      return aiError("not_found", 404, result.message);
    }
    return aiError("invalid_assist_binding", 400, result.message, {
      code: result.code,
    });
  }

  return Response.json({
    conversations: result.conversations.map(serializeConversation),
    reboundCount: result.reboundCount,
    alreadyBound: result.alreadyBound,
  });
}
