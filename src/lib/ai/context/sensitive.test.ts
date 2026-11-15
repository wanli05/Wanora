import { describe, expect, it } from "vitest";
import {
  containsDeniedProfileField,
  jaLocalized,
  MY_CAREER_DENIED_PROFILE_FIELDS,
  MY_CAREER_PROFILE_WHITELIST,
  pickFields,
} from "@/lib/ai/context/sensitive";

describe("sensitive field policy", () => {
  it("keeps whitelist and denied sets disjoint", () => {
    for (const key of MY_CAREER_PROFILE_WHITELIST) {
      expect(MY_CAREER_DENIED_PROFILE_FIELDS).not.toContain(key);
    }
  });

  it("pickFields only copies listed keys", () => {
    const row = {
      fullName: { ja: "山田" },
      phone: "090-0000-0000",
      email: "a@example.com",
      headline: "PL",
    };
    expect(
      pickFields(row, ["fullName", "headline"] as const),
    ).toEqual({ fullName: { ja: "山田" }, headline: "PL" });
  });

  it("detects denied keys in nested payloads", () => {
    expect(containsDeniedProfileField({ profile: { phone: "1" } })).toBe(
      "phone",
    );
    expect(
      containsDeniedProfileField({
        fullName: { ja: "山田" },
        headline: "PL",
      }),
    ).toBeNull();
  });

  it("jaLocalized drops empty text", () => {
    expect(jaLocalized({ ja: "  " })).toBeNull();
    expect(jaLocalized({ ja: "要約", en: "x" })).toEqual({ ja: "要約" });
  });
});
