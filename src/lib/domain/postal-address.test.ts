import { describe, expect, it } from "vitest";
import {
  formatPostalCode,
  hankakuKatakanaToHiragana,
  normalizePostalDigits,
  parseZipcloudResponse,
  postalHitFromZipcloud,
} from "./postal-address";

describe("normalizePostalDigits", () => {
  it("accepts hyphenated and bare 7-digit codes", () => {
    expect(normalizePostalDigits("330-0072")).toBe("3300072");
    expect(normalizePostalDigits("3300072")).toBe("3300072");
    expect(normalizePostalDigits("330-007")).toBeNull();
  });
});

describe("postalHitFromZipcloud", () => {
  it("joins pref/city/town and converts kana to hiragana", () => {
    const hit = postalHitFromZipcloud({
      address1: "埼玉県",
      address2: "さいたま市浦和区",
      address3: "領家",
      kana1: "ｻｲﾀﾏｹﾝ",
      kana2: "ｻｲﾀﾏｼｳﾗﾜｸ",
      kana3: "ﾘｮｳｹ",
      zipcode: "3300072",
    });
    expect(hit).toEqual({
      addressJa: "埼玉県さいたま市浦和区領家",
      addressKana: hankakuKatakanaToHiragana("ｻｲﾀﾏｹﾝｻｲﾀﾏｼｳﾗﾜｸﾘｮｳｹ"),
      postalCode: "330-0072",
    });
    expect(hit?.addressKana).toMatch(/さいたま/);
  });
});

describe("parseZipcloudResponse", () => {
  it("maps not_found when results are null", () => {
    expect(
      parseZipcloudResponse({ status: 200, message: null, results: null }),
    ).toEqual({ ok: false, reason: "not_found" });
  });

  it("returns the first hit", () => {
    const parsed = parseZipcloudResponse({
      status: 200,
      message: null,
      results: [
        {
          address1: "東京都",
          address2: "千代田区",
          address3: "千代田",
          kana1: "ﾄｳｷｮｳﾄ",
          kana2: "ﾁﾖﾀﾞｸ",
          kana3: "ﾁﾖﾀﾞ",
          zipcode: "1000001",
        },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.hit.addressJa).toBe("東京都千代田区千代田");
      expect(parsed.hit.postalCode).toBe(formatPostalCode("1000001"));
    }
  });
});
