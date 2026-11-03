import { describe, expect, it } from "vitest";
import {
  formatJapaneseResumeDate,
  formatYearMonthInputValue,
  fullYearsOld,
  parseDateInput,
  parseYearMonthInputValue,
  yearMonthFromInputValue,
} from "./dates";

describe("fullYearsOld", () => {
  it("uses Tokyo calendar day for 満年齢", () => {
    const birth = parseDateInput("1995-05-03");
    const asOf = parseDateInput("2026-05-02");
    expect(fullYearsOld(birth, asOf)).toBe(30);
    expect(fullYearsOld(birth, parseDateInput("2026-05-03"))).toBe(31);
  });
});

describe("formatJapaneseResumeDate", () => {
  it("formats seireki", () => {
    const d = parseDateInput("2026-11-02");
    expect(formatJapaneseResumeDate(d, "seireki")).toBe("2026年11月2日");
  });

  it("formats wareki with Japanese calendar", () => {
    const d = parseDateInput("2026-11-02");
    const s = formatJapaneseResumeDate(d, "wareki");
    expect(s).toMatch(/令和/);
    expect(s).toMatch(/11月/);
  });
});

describe("year month input", () => {
  it("round-trips HTML month values", () => {
    expect(formatYearMonthInputValue(2020, 4)).toBe("2020-04");
    expect(parseYearMonthInputValue("2021-12")).toEqual({
      year: 2021,
      month: 12,
    });
    expect(yearMonthFromInputValue("2020-04").getUTCDate()).toBe(1);
  });
});
