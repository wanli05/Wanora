import { describe, expect, it } from "vitest";
import {
  findPrepBaseTheme,
  prepBaseThemes,
  PREP_BASE_THEMES,
} from "./base-themes";

describe("prepBaseThemes", () => {
  it("exposes exactly seven stable template ids", () => {
    const list = prepBaseThemes();
    expect(list).toHaveLength(7);
    expect(list.map((t) => t.id)).toEqual([
      "base-self-intro",
      "base-self-pr",
      "base-career-change",
      "base-motivation",
      "base-career-design",
      "base-success-failure",
      "base-reverse-qa",
    ]);
    expect(PREP_BASE_THEMES).toHaveLength(7);
  });

  it("marks success/failure as dual and reverse-qa as list", () => {
    expect(findPrepBaseTheme("base-success-failure")?.answerKind).toBe(
      "dual_experience",
    );
    expect(findPrepBaseTheme("base-reverse-qa")?.answerKind).toBe(
      "reverse_qa_list",
    );
    expect(findPrepBaseTheme("base-motivation")?.answerKind).toBe("text");
  });

  it("returns null for unknown id", () => {
    expect(findPrepBaseTheme("missing")).toBeNull();
  });
});
