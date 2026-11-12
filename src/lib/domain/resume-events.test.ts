import { describe, expect, it } from "vitest";
import { parseDateInput } from "./dates";
import {
  compareTimelineRows,
  employedUntilPhrase,
  resumeSectionClosingPhrase,
} from "./resume-events";

describe("compareTimelineRows", () => {
  it("sorts by year_month then sort_order", () => {
    const rows = [
      { yearMonth: parseDateInput("2020-04-01"), sortOrder: 1 },
      { yearMonth: parseDateInput("2018-04-01"), sortOrder: 0 },
      { yearMonth: parseDateInput("2020-04-01"), sortOrder: 0 },
    ].sort(compareTimelineRows);
    expect(rows.map((r) => r.sortOrder)).toEqual([0, 0, 1]);
    expect(rows[0].yearMonth.getUTCFullYear()).toBe(2018);
  });
});

describe("locale phrases", () => {
  it("uses Japanese closing and present markers", () => {
    expect(resumeSectionClosingPhrase("ja")).toBe("以上");
    expect(resumeSectionClosingPhrase("en")).toBeNull();
    expect(employedUntilPhrase("ja")).toBe("現在に至る");
    expect(employedUntilPhrase("zh-CN")).toBe("至今");
    expect(employedUntilPhrase("en")).toBe("Present");
  });
});
