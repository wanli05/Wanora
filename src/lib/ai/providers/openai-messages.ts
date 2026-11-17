import type { AiChatMessage } from "@/lib/ai/types";

export type OpenAiEasyMessage = {
  role: "system" | "user" | "assistant" | "developer";
  content: string;
};

/**
 * Map Wanora chat messages to Responses easy input items.
 * Privileged policy stays `system`; My Career context must already be `user`
 * (low-trust reference). Optional `instructions` is for fixed product policy only.
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
