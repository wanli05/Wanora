import { getDb } from "@/db";
import {
  aiError,
  conversationIdParamSchema,
  listMessagesQuerySchema,
  notFound,
  parseSearchParams,
  requireAiUser,
  serializeMessage,
  unauthorized,
} from "@/lib/ai/conversation";
import { getUsableAiConversation } from "@/lib/data/ai-conversations";
import {
  countAiMessages,
  listAiMessages,
} from "@/lib/data/ai-messages";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireAiUser(request);
  if (!user) return unauthorized();

  const { id } = await context.params;
  const idParsed = conversationIdParamSchema.safeParse(id);
  if (!idParsed.success) {
    return aiError("invalid_params", 400, "invalid conversation id");
  }

  const query = listMessagesQuerySchema.safeParse(
    parseSearchParams(request.url),
  );
  if (!query.success) {
    return aiError("invalid_query", 400, "invalid query", query.error.flatten());
  }

  const db = getDb();
  const conversation = await getUsableAiConversation(
    db,
    user.id,
    idParsed.data,
  );
  if (!conversation) return notFound();

  const { limit, offset } = query.data;
  const [rows, total] = await Promise.all([
    listAiMessages(db, user.id, idParsed.data, { limit, offset }),
    countAiMessages(db, user.id, idParsed.data),
  ]);

  return Response.json({
    messages: rows.map(serializeMessage),
    pagination: { limit, offset, total },
  });
}
