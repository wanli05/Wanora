import { describe, expect, it } from "vitest";
import { mapMessagesToOpenAiInput } from "@/lib/ai/providers/openai-messages";

describe("mapMessagesToOpenAiInput", () => {
  it("preserves privileged system instructions and user-role context as-is", () => {
    const input = mapMessagesToOpenAiInput([
      { role: "system", content: "fixed policy" },
      {
        role: "user",
        content: "【参照コンテキスト・低信頼データ】\nprofile",
      },
      { role: "user", content: "要約して" },
      { role: "assistant", content: "はい" },
    ]);
    expect(input).toEqual([
      { role: "system", content: "fixed policy" },
      {
        role: "user",
        content: "【参照コンテキスト・低信頼データ】\nprofile",
      },
      { role: "user", content: "要約して" },
      { role: "assistant", content: "はい" },
    ]);
  });
});
