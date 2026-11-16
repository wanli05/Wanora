import { describe, expect, it } from "vitest";
import { mapMessagesToOpenAiInput } from "@/lib/ai/providers/openai-messages";

describe("mapMessagesToOpenAiInput", () => {
  it("preserves system context as system role in input", () => {
    const input = mapMessagesToOpenAiInput([
      { role: "system", content: "【参照コンテキスト】\nprofile" },
      { role: "user", content: "要約して" },
      { role: "assistant", content: "はい" },
    ]);
    expect(input).toEqual([
      { role: "system", content: "【参照コンテキスト】\nprofile" },
      { role: "user", content: "要約して" },
      { role: "assistant", content: "はい" },
    ]);
  });
});
