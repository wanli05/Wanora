import type { AiConversationRow } from "@/lib/data/ai-conversations";
import type { AiMessageRow } from "@/lib/data/ai-messages";

export type AiConversationDto = {
  id: string;
  title: string | null;
  status: "active" | "archived" | "deleted";
  pinnedTarget: unknown;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type AiMessageDto = {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  pageContext: unknown;
  targetContext: unknown;
  clientMessageId: string | null;
  createdAt: string;
};

export function serializeConversation(
  row: AiConversationRow,
): AiConversationDto {
  return {
    id: row.id,
    title: row.title,
    status: row.status as AiConversationDto["status"],
    pinnedTarget: row.pinnedTarget ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

export function serializeMessage(row: AiMessageRow): AiMessageDto {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role,
    content: row.content,
    pageContext: row.pageContext ?? null,
    targetContext: row.targetContext ?? null,
    clientMessageId: row.clientMessageId,
    createdAt: row.createdAt.toISOString(),
  };
}

export type PaginationDto = {
  limit: number;
  offset: number;
  total: number;
};
