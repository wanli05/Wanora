import { describe, expect, it } from "vitest";
import { extractRefinedText } from "./extract-refined-text";
import {
  REFINE_RESULT_END,
  REFINE_RESULT_START,
} from "./refine-prompts";

describe("extractRefinedText", () => {
  it("extracts body between markers", () => {
    const content = [
      "了解しました。",
      REFINE_RESULT_START,
      "改善された自己PR",
      REFINE_RESULT_END,
      "【補足】成果の数値があれば追記してください。",
    ].join("\n");
    expect(extractRefinedText(content)).toBe("改善された自己PR");
  });

  it("returns null when markers are missing or empty", () => {
    expect(extractRefinedText("ただの説明です")).toBeNull();
    expect(
      extractRefinedText(`${REFINE_RESULT_START}\n\n${REFINE_RESULT_END}`),
    ).toBeNull();
  });
});
