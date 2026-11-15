import { describe, expect, it } from "vitest";
import { trimContextFragments } from "@/lib/ai/context/trim";
import type { AiContextFragment } from "@/lib/ai/context/types";

function frag(
  section: string,
  data: unknown,
  sourceId = "my_career",
): AiContextFragment {
  return {
    sourceId,
    section,
    label: section,
    data,
    charCount: JSON.stringify(data).length,
  };
}

describe("trimContextFragments", () => {
  it("keeps source attribution when omitting large sections", () => {
    const bulky = "あ".repeat(500);
    const input = [
      frag("target", { id: "t1", title: { ja: "対象" } }),
      frag("profile", { fullName: { ja: "山田" } }),
      frag("projects", [{ overview: { ja: bulky } }]),
      frag("goals", [{ content: { ja: bulky } }]),
    ];

    const result = trimContextFragments(input, 400);
    expect(result.truncated).toBe(true);
    expect(result.totalChars).toBeLessThanOrEqual(400);

    const bySection = Object.fromEntries(
      result.fragments.map((f) => [f.section, f]),
    );
    expect(bySection.target.data).toMatchObject({ id: "t1" });
    expect(bySection.goals.truncated).toBe(true);
    expect(bySection.goals.data).toMatchObject({
      omitted: true,
      sourceId: "my_career",
      section: "goals",
    });
  });

  it("is a no-op under the budget", () => {
    const input = [frag("profile", { headline: "PL" })];
    const result = trimContextFragments(input, 10_000);
    expect(result.truncated).toBe(false);
    expect(result.fragments[0].data).toEqual({ headline: "PL" });
  });
});
