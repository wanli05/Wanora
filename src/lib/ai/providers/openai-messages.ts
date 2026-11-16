import type { AiChatMessage } from "@/lib/ai/types";

export type OpenAiEasyMessage = {
  role: "system" | "user" | "assistant" | "developer";
  content: string;
};

/**
 * Map Wanora chat messages to Responses easy input items.
 * System/context stay as `system` role in `input` (not high-priority instructions).
 * Product system instructions are passed separately via `instructions` when set.
 */
export function mapMessagesToOpenAiInput(
  messages: AiChatMessage[],
): OpenAiEasyMessage[] {
  const out: OpenAiEasyMessage[] = [];
  for (const m of messages) {
    const content = m.content ?? "";
    if (m.role === "system" || m.role === "user" || m.role === "assistant") {
      out.push({ role: m.role, content });
    }
  }
  return out;
}
