import type { AiChatMessage } from "@/lib/ai/types";
import { B1_SYSTEM_INSTRUCTIONS } from "@/lib/ai/prompts/b1-system";
import { getServerEnv } from "@/lib/env";

export function formatContextForPrompt(
  fragments: { label: string; data: unknown }[],
): string {
  if (fragments.length === 0) return "";
  const parts = fragments.map((f) => {
    const body =
      typeof f.data === "string" ? f.data : JSON.stringify(f.data, null, 0);
    return `### ${f.label}\n${body}`;
  });
  return `【参照コンテキスト】\n${parts.join("\n\n")}`;
}

/**
 * Build the message list used for both reservation estimates and provider calls.
 * System instructions stay separate from My Career context (reference data).
 */
export function buildAiChatMessages(args: {
  fragments: { label: string; data: unknown }[];
  history: { role: string; content: string }[];
  /** When true, include B1 fixed instructions as the first system message. */
  includeSystemInstructions?: boolean;
  maxHistoryMessages?: number;
  maxInputChars?: number;
}): AiChatMessage[] {
  const env = getServerEnv();
  const maxHistory =
    args.maxHistoryMessages ?? env.AI_MAX_HISTORY_MESSAGES;
  const maxChars = args.maxInputChars ?? env.AI_MAX_INPUT_CHARS;

  const messages: AiChatMessage[] = [];
  if (args.includeSystemInstructions !== false) {
    messages.push({ role: "system", content: B1_SYSTEM_INSTRUCTIONS });
  }
  const contextBlock = formatContextForPrompt(args.fragments);
  if (contextBlock) {
    messages.push({ role: "system", content: contextBlock });
  }

  const history = args.history
    .filter(
      (m) =>
        m.role === "system" || m.role === "user" || m.role === "assistant",
    )
    .slice(-maxHistory);

  for (const m of history) {
    messages.push({
      role: m.role as AiChatMessage["role"],
      content: m.content,
    });
  }

  // Soft char cap: drop oldest non-instruction messages first.
  let total = messages.reduce((n, m) => n + m.content.length, 0);
  if (total <= maxChars) return messages;

  const protectedCount =
    (args.includeSystemInstructions !== false ? 1 : 0) +
    (contextBlock ? 1 : 0);
  while (total > maxChars && messages.length > protectedCount) {
    const removed = messages.splice(protectedCount, 1)[0];
    total -= removed?.content.length ?? 0;
  }
  return messages;
}

/** Rough CJK-friendly token estimate — prediction only, not a hard tokenizer. */
export function estimateTokensFromText(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 2));
}

export function estimateTokensFromMessages(messages: AiChatMessage[]): number {
  // +4 per message for role/formatting overhead (conservative).
  return messages.reduce(
    (n, m) => n + estimateTokensFromText(m.content) + 4,
    0,
  );
}
