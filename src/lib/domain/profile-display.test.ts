import { describe, expect, it } from "vitest";
import {
  formatWorkHistoryYearMonthEvent,
  formatYearMonthJa,
} from "./profile-display";

describe("profile-display", () => {
  it("formats year-month for table cells", () => {
    expect(formatYearMonthJa(2020, 4)).toBe("2020年4月");
    expect(formatYearMonthJa(2021, 12)).toBe("2021年12月");
  });

  it("formats work history year-month with event", () => {
    expect(formatWorkHistoryYearMonthEvent(2024, 4, "入社")).toBe(
      "2024年4月 入社",
    );
  });
});
