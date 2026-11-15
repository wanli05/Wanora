import { describe, expect, it } from "vitest";
import { enqueueJobBodySchema, jobIdParamSchema } from "@/lib/ai/jobs/schemas";

describe("enqueueJobBodySchema", () => {
  it("accepts a minimal valid body and defaults feature", () => {
    const parsed = enqueueJobBodySchema.parse({
      conversationId: "11111111-1111-4111-8111-111111111111",
      clientRequestId: "req-1",
      content: "こんにちは",
    });
    expect(parsed.feature).toBe("chat");
    expect(parsed.pageContext).toBeUndefined();
  });

  it("rejects empty content and invalid uuid", () => {
    expect(
      enqueueJobBodySchema.safeParse({
        conversationId: "not-a-uuid",
        clientRequestId: "x",
        content: "hi",
      }).success,
    ).toBe(false);
    expect(
      enqueueJobBodySchema.safeParse({
        conversationId: "11111111-1111-4111-8111-111111111111",
        clientRequestId: "x",
        content: "   ",
      }).success,
    ).toBe(false);
  });

  it("validates job id params", () => {
    expect(jobIdParamSchema.safeParse("bad").success).toBe(false);
    expect(
      jobIdParamSchema.safeParse("11111111-1111-4111-8111-111111111111")
        .success,
    ).toBe(true);
  });
});
