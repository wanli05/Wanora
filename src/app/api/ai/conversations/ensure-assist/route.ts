import { getDb } from "@/db";
import {
  aiError,
  ensureAssistConversationBodySchema,
  requireAiUser,
  serializeConversation,
  unauthorized,
} from "@/lib/ai/conversation";
import { ensureAssistConversation } from "@/lib/ai/conversation/ensure-assist";

export async function POST(request: Request) {
  const user = await requireAiUser(request);
  if (!user) return unauthorized();

  const parsed = ensureAssistConversationBodySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return aiError("invalid_body", 400, "invalid body", parsed.error.flatten());
  }

  const result = await ensureAssistConversation(getDb(), {
    userId: user.id,
    assistSlotKey: parsed.data.assistSlotKey,
    pinnedTarget: parsed.data.pinnedTarget,
    title: parsed.data.title,
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
    conversation: serializeConversation(result.conversation),
    created: result.created,
  });
}
