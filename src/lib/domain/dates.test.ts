import { describe, expect, it } from "vitest";
import {
  compareYearMonthDates,
  compareYearMonthInputValues,
  formatJapaneseResumeDate,
  formatYearMonthInputValue,
  fullYearsOld,
  parseDateInput,
  parseYearMonthInputValue,
  sortByYearMonthInput,
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

  it("sorts by year then month with empty values last", () => {
    expect(compareYearMonthInputValues("2020-04", "2021-01")).toBeLessThan(0);
    expect(compareYearMonthInputValues("", "2020-04")).toBeGreaterThan(0);
    expect(
      sortByYearMonthInput([
        { yearMonth: "2022-04", label: "b" },
        { yearMonth: "2018-04", label: "a" },
      ]).map((row) => row.label),
    ).toEqual(["a", "b"]);
  });

  it("compares stored dates by calendar year and month", () => {
    const earlier = parseDateInput("2018-04-01");
    const later = parseDateInput("2020-10-01");
    expect(compareYearMonthDates(earlier, later)).toBeLessThan(0);
  });
});
