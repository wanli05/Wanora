import { describe, expect, it } from "vitest";
import {
  AI_CONVERSATIONS_MAX_LIMIT,
  AI_MESSAGES_MAX_LIMIT,
  createConversationBodySchema,
  listConversationsQuerySchema,
  listMessagesQuerySchema,
  patchConversationBodySchema,
} from "@/lib/ai/conversation/schemas";

describe("conversation schemas", () => {
  it("defaults pagination and rejects oversized limits", () => {
    const ok = listConversationsQuerySchema.parse({});
    expect(ok.limit).toBe(20);
    expect(ok.offset).toBe(0);

    expect(
      listConversationsQuerySchema.safeParse({
        limit: String(AI_CONVERSATIONS_MAX_LIMIT + 1),
      }).success,
    ).toBe(false);

    expect(
      listMessagesQuerySchema.safeParse({
        limit: String(AI_MESSAGES_MAX_LIMIT + 1),
      }).success,
    ).toBe(false);
  });

  it("parses includeArchived and status", () => {
    expect(
      listConversationsQuerySchema.parse({ includeArchived: "true" })
        .includeArchived,
    ).toBe(true);
    expect(
      listConversationsQuerySchema.parse({ status: "archived" }).status,
    ).toBe("archived");
  });

  it("limits title length and rejects empty patches", () => {
    expect(
      createConversationBodySchema.safeParse({
        title: "あ".repeat(201),
      }).success,
    ).toBe(false);
    expect(createConversationBodySchema.parse({ title: "会話" }).title).toBe(
      "会話",
    );
    expect(patchConversationBodySchema.safeParse({}).success).toBe(false);
    expect(
      patchConversationBodySchema.parse({ status: "archived" }).status,
    ).toBe("archived");
  });

  it("validates pinnedTarget shape", () => {
    expect(
      createConversationBodySchema.safeParse({
        pinnedTarget: { type: "career_project", id: "not-a-uuid" },
      }).success,
    ).toBe(false);
    expect(
      createConversationBodySchema.parse({
        pinnedTarget: {
          type: "profile",
          section: "self_pr",
        },
      }).pinnedTarget,
    ).toEqual({ type: "profile", section: "self_pr" });
  });
});
