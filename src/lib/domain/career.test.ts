import { describe, expect, it } from "vitest";
import {
  formatExportAsOfJa,
  formatExportAsOfRirekisho,
  isJapaneseNationality,
  parseDirectionTags,
  parseLanguages,
} from "./career";

describe("career domain", () => {
  it("parses direction tags and languages", () => {
    expect(parseDirectionTags([" 要件定義 ", "", 1])).toEqual(["要件定義"]);
    expect(
      parseLanguages([
        { language: "日本語", level: "ビジネス" },
        { language: "", level: "x" },
        { foo: 1 },
      ]),
    ).toEqual([{ language: "日本語", level: "ビジネス" }]);
  });

  it("detects Japanese nationality for locking 在留 fields", () => {
    expect(isJapaneseNationality("日本")).toBe(true);
    expect(isJapaneseNationality("日本国")).toBe(true);
    expect(isJapaneseNationality("Japan")).toBe(true);
    expect(isJapaneseNationality("中国")).toBe(false);
    expect(isJapaneseNationality("")).toBe(false);
  });

  it("formats Asia/Tokyo 現在 date for export", () => {
    const fixed = new Date("2026-11-13T03:00:00.000Z");
    expect(formatExportAsOfJa(fixed)).toBe("2026年11月13日現在");
    expect(formatExportAsOfRirekisho(fixed)).toBe("2026　年　11月　13日現在");
  });
});
