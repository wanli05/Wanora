import { z } from "zod";
import { pinnedTargetSchema } from "@/lib/ai/conversation/schemas";

export const AI_CHAT_MESSAGE_MAX = 8_000;
export const AI_CHAT_HISTORY_LIMIT = 40;

export const pageContextSchema = z
  .object({
    path: z.string().trim().min(1).max(500),
    area: z.enum(["my_career", "board", "other"]).optional(),
    label: z.string().trim().max(200).optional(),
  })
  .strict();

export const chatBodySchema = z
  .object({
    conversationId: z.uuid(),
    message: z.string().trim().min(1).max(AI_CHAT_MESSAGE_MAX),
    clientMessageId: z.string().trim().min(1).max(128),
    pageContext: pageContextSchema.nullable().optional(),
    /** Explicit Target only — never inferred from pageContext. */
    targetContext: pinnedTargetSchema.optional(),
  })
  .strict();

export type ChatBody = z.infer<typeof chatBodySchema>;

export function assistantClientMessageId(clientMessageId: string) {
  return `${clientMessageId}::assistant`;
}

export function chatRequestId(clientMessageId: string) {
  return `chat:${clientMessageId}`;
}
