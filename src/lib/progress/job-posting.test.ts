import { describe, expect, it } from "vitest";
import { hasJobPostingContent, normalizeOptionalText } from "./job-posting";

describe("hasJobPostingContent", () => {
  it("is false when every field is empty", () => {
    expect(
      hasJobPostingContent({
        jobUrl: null,
        salaryBandText: "  ",
        benefitsText: null,
        jdText: "",
        processNotes: null,
        workLocationText: null,
        jobNotes: null,
      }),
    ).toBe(false);
  });

  it("is true when any field has content", () => {
    expect(
      hasJobPostingContent({
        jobUrl: "https://example.com/job",
        salaryBandText: null,
        benefitsText: null,
        jdText: null,
        processNotes: null,
        workLocationText: null,
        jobNotes: null,
      }),
    ).toBe(true);
  });
});

describe("normalizeOptionalText", () => {
  it("trims and nulls blanks", () => {
    expect(normalizeOptionalText("  hello  ")).toBe("hello");
    expect(normalizeOptionalText("   ")).toBeNull();
    expect(normalizeOptionalText(null)).toBeNull();
  });
});
