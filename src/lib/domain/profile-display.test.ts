import { describe, expect, it } from "vitest";
import {
  formatEducationLine,
  formatLicenseLine,
  formatWorkHistoryLine,
} from "./profile-display";

describe("profile-display", () => {
  it("formats education like rirekisho", () => {
    expect(formatEducationLine(2020, 4, "テスト大学", "入学")).toBe(
      "2020年4月，テスト大学 入学",
    );
  });

  it("formats work history date and event", () => {
    expect(formatWorkHistoryLine(2024, 4, "入社")).toBe("2024年，4月，入社");
  });

  it("formats license line", () => {
    expect(formatLicenseLine(2025, 12, "日本語能力試験N1", "取得")).toBe(
      "2025年12月，日本語能力試験N1 取得",
    );
  });
});
