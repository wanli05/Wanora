import { describe, expect, it } from "vitest";
import {
  formatJapaneseResumeDate,
  formatYearMonthColumn,
  fullYearsOld,
  parseDateInput,
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

describe("formatYearMonthColumn", () => {
  it("returns numeric month and seireki year", () => {
    const ym = parseDateInput("2024-04-01");
    expect(formatYearMonthColumn(ym, "seireki")).toEqual({
      yearLabel: "2024",
      monthLabel: "4",
    });
  });
});
