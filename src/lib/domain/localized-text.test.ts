import { describe, expect, it } from "vitest";
import {
  countLocalizedFilled,
  japaneseTextFromForm,
  localizedTextCompletion,
  parseLocalizedText,
  resolveLocalizedText,
} from "./localized-text";

describe("resolveLocalizedText", () => {
  it("returns the requested locale when present", () => {
    const text = { ja: "山田", en: "Yamada" };
    expect(resolveLocalizedText(text, "ja")).toEqual({
      value: "山田",
      sourceLocale: "ja",
      usedFallback: false,
    });
  });

  it("falls back in locale-specific order", () => {
    const text = { ja: "山田太郎" };
    const en = resolveLocalizedText(text, "en");
    expect(en?.value).toBe("山田太郎");
    expect(en?.usedFallback).toBe(true);
    expect(en?.sourceLocale).toBe("ja");
  });

  it("trims whitespace and ignores empty strings", () => {
    expect(parseLocalizedText({ ja: "  ", en: "A" })).toEqual({ en: "A" });
    expect(resolveLocalizedText({ ja: "  x  " }, "ja")?.value).toBe("x");
  });
});

describe("localizedTextCompletion", () => {
  it("counts filled locales", () => {
    const text = parseLocalizedText({ ja: "a", "zh-CN": "b" });
    expect(localizedTextCompletion(text)).toEqual({
      ja: true,
      "zh-CN": true,
      en: false,
    });
    expect(countLocalizedFilled(text)).toBe(2);
  });
});

describe("japaneseTextFromForm", () => {
  it("reads fullName_ja", () => {
    const fd = new FormData();
    fd.set("school_ja", "東京大学");
    fd.set("school_en", "Tokyo");
    expect(japaneseTextFromForm(fd, "school")).toEqual({ ja: "東京大学" });
  });
});
