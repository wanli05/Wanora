import { describe, expect, it } from "vitest";
import { translateResumeTextForExport } from "./export-translation";

describe("translateResumeTextForExport", () => {
  it("returns Japanese unchanged until translation API is integrated", () => {
    expect(translateResumeTextForExport("履歴書", "en")).toBe("履歴書");
    expect(translateResumeTextForExport("履歴書", "zh-CN")).toBe("履歴書");
  });
});
