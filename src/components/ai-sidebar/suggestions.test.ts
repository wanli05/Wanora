import { describe, expect, it } from "vitest";
import { suggestionsForPage, targetSelectValue } from "./suggestions";

describe("suggestionsForPage", () => {
  it("returns My Career chips without claiming field reads", () => {
    const chips = suggestionsForPage({ area: "my_career" });
    expect(chips.map((c) => c.id)).toEqual([
      "self_pr",
      "career_analyze",
      "career_chat",
    ]);
    expect(chips[0]?.target).toEqual({ type: "profile", section: "self_pr" });
    expect(chips[2]?.target).toBeNull();
  });

  it("returns board chips with null targets", () => {
    const chips = suggestionsForPage({ area: "board" });
    expect(chips.every((c) => c.target === null)).toBe(true);
  });
});

describe("targetSelectValue", () => {
  it("maps null and profile sections", () => {
    expect(targetSelectValue(null)).toBe("");
    expect(
      targetSelectValue({ type: "profile", section: "job_summary" }),
    ).toBe("profile:job_summary");
  });
});
