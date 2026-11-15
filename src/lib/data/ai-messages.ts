import { and, asc, eq } from "drizzle-orm";
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

export async function listAiMessages(
  db: Db,
  userId: string,
  conversationId: string,
) {
  return db
    .select()
    .from(aiMessages)
    .where(
      and(
        eq(aiMessages.userId, userId),
        eq(aiMessages.conversationId, conversationId),
      ),
    )
    .orderBy(asc(aiMessages.createdAt));
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
