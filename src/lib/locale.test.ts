import { describe, expect, it } from "vitest";
import { isLocale } from "./locale";

describe("isLocale", () => {
  it.each(["ja", "zh-CN", "en"])("accepts %s", (l) => {
    expect(isLocale(l)).toBe(true);
  });

  it.each(["zh", "zh-cn", "fr", "", null])("rejects %s", (l) => {
    expect(isLocale(l)).toBe(false);
  });
});
