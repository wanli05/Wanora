import { describe, expect, it } from "vitest";
import {
  AI_CHAT_MESSAGE_MAX,
  chatBodySchema,
} from "@/lib/ai/chat/schemas";

describe("chatBodySchema", () => {
  const base = {
    conversationId: "550e8400-e29b-41d4-a716-446655440000",
    message: "こんにちは",
    clientMessageId: "client-1",
  };

  it("accepts valid payloads and optional contexts", () => {
    expect(
      chatBodySchema.parse({
        ...base,
        pageContext: { path: "/career", area: "my_career" },
        targetContext: { type: "profile", section: "self_pr" },
      }),
    ).toMatchObject({
      message: "こんにちは",
      targetContext: { type: "profile", section: "self_pr" },
    });
  });

  it("rejects empty message, oversized message, and bad ids", () => {
    expect(chatBodySchema.safeParse({ ...base, message: "  " }).success).toBe(
      false,
    );
    expect(
      chatBodySchema.safeParse({
        ...base,
        message: "あ".repeat(AI_CHAT_MESSAGE_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      chatBodySchema.safeParse({
        ...base,
        conversationId: "nope",
      }).success,
    ).toBe(false);
  });
});
