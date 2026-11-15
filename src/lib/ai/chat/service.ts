import type { Db } from "@/db";
import {
  AI_CHAT_HISTORY_LIMIT,
  assistantClientMessageId,
  chatRequestId,
  type ChatBody,
} from "@/lib/ai/chat/schemas";
import { buildChatProviderMessages } from "@/lib/ai/chat/prompt";
import { isUniqueViolation } from "@/lib/ai/chat/unique";
import { resolveAiContext } from "@/lib/ai/context/resolve";
import type { AiPageContext, AiTargetContext } from "@/lib/ai/context/types";
import { guardedComplete } from "@/lib/ai/guard";
import { withUserAiLock } from "@/lib/ai/rate-limit";
import type { AiProvider } from "@/lib/ai/types";
import { getServerEnv } from "@/lib/env";
import {
  getAiConversation,
  touchAiConversation,
  updateAiConversation,
  type AiConversationRow,
} from "@/lib/data/ai-conversations";
import {
  createAiMessage,
  findAiMessageByClientId,
  listRecentAiMessages,
  type AiMessageRow,
} from "@/lib/data/ai-messages";

export type ChatServiceSuccess = {
  ok: true;
  replayed: boolean;
  conversation: AiConversationRow;
  userMessage: AiMessageRow;
  assistantMessage: AiMessageRow;
  usageEventId: string;
  provider: string;
  model: string;
  latencyMs: number;
};

export type ChatServiceFailure = {
  ok: false;
  code:
    | "not_found"
    | "conversation_archived"
    | "ai_unavailable"
    | "rate_limited"
    | "budget_exceeded"
    | "provider_error"
    | "duplicate_request"
    | "invalid_request";
  message: string;
  detail?: string;
  usageEventId?: string;
};

export type ChatServiceResult = ChatServiceSuccess | ChatServiceFailure;

export type RunMockChatInput = ChatBody & {
  userId: string;
  provider?: AiProvider;
  now?: Date;
};

function asTarget(value: unknown): AiTargetContext | null {
  if (!value || typeof value !== "object") return null;
  return value as AiTargetContext;
}

async function ensureUserMessage(
  db: Db,
  input: {
    userId: string;
    conversationId: string;
    message: string;
    clientMessageId: string;
    pageContext: AiPageContext | null;
    targetContext: AiTargetContext | null;
  },
): Promise<AiMessageRow> {
  const existing = await findAiMessageByClientId(
    db,
    input.userId,
    input.clientMessageId,
  );
  if (existing) return existing;

  try {
    return await createAiMessage(db, input.userId, input.conversationId, {
      role: "user",
      content: input.message,
      clientMessageId: input.clientMessageId,
      pageContext: input.pageContext,
      targetContext: input.targetContext,
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const raced = await findAiMessageByClientId(
      db,
      input.userId,
      input.clientMessageId,
    );
    if (raced) return raced;
    throw error;
  }
}

async function ensureAssistantMessage(
  db: Db,
  input: {
    userId: string;
    conversationId: string;
    clientMessageId: string;
    content: string;
    pageContext: AiPageContext | null;
    targetContext: AiTargetContext | null;
  },
): Promise<AiMessageRow> {
  const assistantKey = assistantClientMessageId(input.clientMessageId);
  const existing = await findAiMessageByClientId(
    db,
    input.userId,
    assistantKey,
  );
  if (existing) return existing;

  try {
    return await createAiMessage(db, input.userId, input.conversationId, {
      role: "assistant",
      content: input.content,
      clientMessageId: assistantKey,
      pageContext: input.pageContext,
      targetContext: input.targetContext,
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const raced = await findAiMessageByClientId(
      db,
      input.userId,
      assistantKey,
    );
    if (raced) return raced;
    throw error;
  }
}

/**
 * Mock multi-turn chat: ownership → active check → context resolve →
 * guardedComplete → persist messages. Idempotent on clientMessageId.
 * Messages are written only after a successful (or replayed) completion so
 * budget/rate rejects and provider failures do not leave orphan turns.
 */
export async function runMockChat(
  db: Db,
  input: RunMockChatInput,
): Promise<ChatServiceResult> {
  const conversation = await getAiConversation(
    db,
    input.userId,
    input.conversationId,
  );
  if (!conversation || conversation.status === "deleted") {
    return { ok: false, code: "not_found", message: "conversation not found" };
  }
  if (conversation.status === "archived") {
    return {
      ok: false,
      code: "conversation_archived",
      message: "archived conversations cannot accept new messages",
    };
  }

  if (!getServerEnv().AI_ENABLED) {
    return { ok: false, code: "ai_unavailable", message: "AI is disabled" };
  }

  const pageContext = (input.pageContext ?? null) as AiPageContext | null;
  const explicitTarget =
    input.targetContext === undefined
      ? undefined
      : asTarget(input.targetContext);
  const targetContext =
    explicitTarget !== undefined
      ? explicitTarget
      : asTarget(conversation.pinnedTarget);

  if (explicitTarget !== undefined) {
    const updated = await updateAiConversation(
      db,
      input.userId,
      input.conversationId,
      { pinnedTarget: explicitTarget },
    );
    if (!updated) {
      return { ok: false, code: "not_found", message: "conversation not found" };
    }
  }

  const assistantKey = assistantClientMessageId(input.clientMessageId);

  const early = await db.transaction(async (tx) => {
    return withUserAiLock(tx, input.userId, async () => {
      const userMsg = await findAiMessageByClientId(
        tx,
        input.userId,
        input.clientMessageId,
      );
      const assistantMsg = await findAiMessageByClientId(
        tx,
        input.userId,
        assistantKey,
      );
      if (userMsg && assistantMsg) {
        return { userMsg, assistantMsg } as const;
      }
      return null;
    });
  });

  if (early) {
    return {
      ok: true,
      replayed: true,
      conversation,
      userMessage: early.userMsg,
      assistantMessage: early.assistantMsg,
      usageEventId: "",
      provider: "mock",
      model: "mock-v1",
      latencyMs: 0,
    };
  }

  const resolved = await resolveAiContext(db, {
    userId: input.userId,
    pageContext,
    targetContext,
    conversation: { conversationId: input.conversationId },
  });

  const history = await listRecentAiMessages(
    db,
    input.userId,
    input.conversationId,
    AI_CHAT_HISTORY_LIMIT,
  );

  const providerMessages = buildChatProviderMessages({
    context: resolved,
    history,
    userMessage: input.message,
  });

  const guardInput = {
    userId: input.userId,
    requestId: chatRequestId(input.clientMessageId),
    feature: "chat",
    messages: providerMessages,
    conversationId: input.conversationId,
    provider: input.provider,
    now: input.now,
  };

  let guardOutcome;
  try {
    guardOutcome = await guardedComplete(db, guardInput);
    // Concurrent same clientMessageId: peer may hold `reserved`. Wait for
    // peer messages or a replayable guard success instead of failing loudly.
    for (
      let attempt = 0;
      !guardOutcome.ok &&
      guardOutcome.code === "duplicate_request" &&
      attempt < 15;
      attempt++
    ) {
      const peer = await db.transaction(async (tx) => {
        return withUserAiLock(tx, input.userId, async () => {
          const userMsg = await findAiMessageByClientId(
            tx,
            input.userId,
            input.clientMessageId,
          );
          const assistantMsg = await findAiMessageByClientId(
            tx,
            input.userId,
            assistantKey,
          );
          if (userMsg && assistantMsg) {
            return { userMsg, assistantMsg } as const;
          }
          return null;
        });
      });
      if (peer) {
        return {
          ok: true,
          replayed: true,
          conversation,
          userMessage: peer.userMsg,
          assistantMessage: peer.assistantMsg,
          usageEventId: guardOutcome.usageEventId ?? "",
          provider: "mock",
          model: "mock-v1",
          latencyMs: 0,
        };
      }
      await new Promise((r) => setTimeout(r, 20));
      guardOutcome = await guardedComplete(db, guardInput);
    }
  } catch (error) {
    return {
      ok: false,
      code: "provider_error",
      message: error instanceof Error ? error.message : "provider failed",
    };
  }

  if (!guardOutcome.ok) {
    return {
      ok: false,
      code: guardOutcome.code,
      message: guardOutcome.message,
      detail: guardOutcome.detail,
      usageEventId: guardOutcome.usageEventId,
    };
  }

  const completion = guardOutcome.result;
  const usageEventId = guardOutcome.usageEventId;
  const replayed = Boolean(guardOutcome.replayed);

  const persisted = await db.transaction(async (tx) => {
    return withUserAiLock(tx, input.userId, async () => {
      const userMessage = await ensureUserMessage(tx, {
        userId: input.userId,
        conversationId: input.conversationId,
        message: input.message,
        clientMessageId: input.clientMessageId,
        pageContext,
        targetContext,
      });
      const assistantMessage = await ensureAssistantMessage(tx, {
        userId: input.userId,
        conversationId: input.conversationId,
        clientMessageId: input.clientMessageId,
        content: completion.text,
        pageContext,
        targetContext,
      });
      await touchAiConversation(tx, input.userId, input.conversationId);
      return { userMessage, assistantMessage };
    });
  });

  const refreshed =
    (await getAiConversation(db, input.userId, input.conversationId)) ??
    conversation;

  return {
    ok: true,
    replayed,
    conversation: refreshed,
    userMessage: persisted.userMessage,
    assistantMessage: persisted.assistantMessage,
    usageEventId,
    provider: completion.provider,
    model: completion.model,
    latencyMs: completion.latencyMs,
  };
}
