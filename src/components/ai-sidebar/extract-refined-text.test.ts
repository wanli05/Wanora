import { describe, expect, it } from "vitest";
import { extractRefinedText } from "./extract-refined-text";
import {
  REFINE_RESULT_END,
  REFINE_RESULT_START,
} from "./refine-prompts";

const S = REFINE_RESULT_START;
const E = REFINE_RESULT_END;

describe("extractRefinedText", () => {
  it("extracts body between a single marker pair", () => {
    const content = [
      "了解しました。",
      S,
      "改善された自己PR",
      E,
      "【補足】成果の数値があれば追記してください。",
    ].join("\n");
    expect(extractRefinedText(content)).toBe("改善された自己PR");
  });

  it("returns null when markers are missing or empty", () => {
    expect(extractRefinedText("ただの説明です")).toBeNull();
    expect(extractRefinedText(`${S}\n\n${E}`)).toBeNull();
    expect(extractRefinedText(`${S}\n   \n${E}`)).toBeNull();
    expect(extractRefinedText(`良い文\n${E}`)).toBeNull();
    expect(extractRefinedText(`${S}\n良い文\n`)).toBeNull();
  });

  it("returns null for duplicate marker pairs (fail-closed)", () => {
    expect(
      extractRefinedText(`${S}\nA\n${E}\n${S}\nB\n${E}`),
    ).toBeNull();
  });

  it("returns null when markers appear in quoted content plus a real pair", () => {
    expect(
      extractRefinedText(`引用:${S}旧${E}\n${S}\n新\n${E}`),
    ).toBeNull();
  });

  it("returns null for nested or ambiguous markers", () => {
    expect(
      extractRefinedText(`${S}\n${S}\n内\n${E}\n外\n${E}`),
    ).toBeNull();
    expect(extractRefinedText(`${E}\n${S}\n本文\n${E}`)).toBeNull();
  });

  it("handles long single-pair replies", () => {
    const body = "あ".repeat(20_000);
    expect(extractRefinedText(`${S}\n${body}\n${E}`)).toBe(body);
  });
});
