import { and, asc, count, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { aiMessages, type AiMessageRole } from "@/db/schema";

export type AiMessageRow = typeof aiMessages.$inferSelect;

export type AiMessageInput = {
  role: AiMessageRole;
  content: string;
  pageContext?: unknown;
  targetContext?: unknown;
  clientMessageId?: string | null;
};

export type ListAiMessagesOptions = {
  limit?: number;
  offset?: number;
};

export async function listAiMessages(
  db: Db,
  userId: string,
  conversationId: string,
  options?: ListAiMessagesOptions,
) {
  const limit = options?.limit;
  const offset = options?.offset ?? 0;
  const query = db
    .select()
    .from(aiMessages)
    .where(
      and(
        eq(aiMessages.userId, userId),
        eq(aiMessages.conversationId, conversationId),
      ),
    )
    .orderBy(asc(aiMessages.createdAt));

  if (limit !== undefined) {
    return query.limit(limit).offset(offset);
  }
  return query;
}

export async function countAiMessages(
  db: Db,
  userId: string,
  conversationId: string,
) {
  const [row] = await db
    .select({ n: count() })
    .from(aiMessages)
    .where(
      and(
        eq(aiMessages.userId, userId),
        eq(aiMessages.conversationId, conversationId),
      ),
    );
  return Number(row?.n ?? 0);
}

export async function createAiMessage(
  db: Db,
  userId: string,
  conversationId: string,
  input: AiMessageInput,
) {
  const [row] = await db
    .insert(aiMessages)
    .values({
      userId,
      conversationId,
      role: input.role,
      content: input.content,
      pageContext: input.pageContext ?? null,
      targetContext: input.targetContext ?? null,
      clientMessageId: input.clientMessageId ?? null,
    })
    .returning();
  return row;
}

export async function findAiMessageByClientId(
  db: Db,
  userId: string,
  clientMessageId: string,
) {
  const [row] = await db
    .select()
    .from(aiMessages)
    .where(
      and(
        eq(aiMessages.userId, userId),
        eq(aiMessages.clientMessageId, clientMessageId),
      ),
    )
    .limit(1);
  return row ?? null;
}
