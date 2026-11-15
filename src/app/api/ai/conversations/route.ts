import { getDb } from "@/db";
import {
  createConversationBodySchema,
  listConversationsQuerySchema,
  parseSearchParams,
  requireAiUser,
  serializeConversation,
  unauthorized,
  aiError,
} from "@/lib/ai/conversation";
import {
  countAiConversations,
  createAiConversation,
  listAiConversations,
} from "@/lib/data/ai-conversations";

export async function GET(request: Request) {
  const user = await requireAiUser(request);
  if (!user) return unauthorized();

  const parsed = listConversationsQuerySchema.safeParse(
    parseSearchParams(request.url),
  );
  if (!parsed.success) {
    return aiError("invalid_query", 400, "invalid query", parsed.error.flatten());
  }

  const { limit, offset, includeArchived, status } = parsed.data;
  const db = getDb();
  const listOpts = {
    includeArchived: includeArchived || undefined,
    status,
    limit,
    offset,
  };
  const [rows, total] = await Promise.all([
    listAiConversations(db, user.id, listOpts),
    countAiConversations(db, user.id, {
      includeArchived: includeArchived || undefined,
      status,
    }),
  ]);

  return Response.json({
    conversations: rows.map(serializeConversation),
    pagination: { limit, offset, total },
  });
}

export async function POST(request: Request) {
  const user = await requireAiUser(request);
  if (!user) return unauthorized();

  const parsed = createConversationBodySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return aiError("invalid_body", 400, "invalid body", parsed.error.flatten());
  }

  const row = await createAiConversation(getDb(), user.id, {
    title: parsed.data.title ?? null,
    pinnedTarget: parsed.data.pinnedTarget,
  });

  return Response.json(
    { conversation: serializeConversation(row) },
    { status: 201 },
  );
}
