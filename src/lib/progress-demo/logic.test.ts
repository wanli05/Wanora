import { describe, expect, it } from "vitest";
import { SAMPLE_APPLICATIONS } from "./fixtures";
import {
  applicationHasConflict,
  cellOccupancy,
  currentStage,
  defaultFreeSlots,
  detectHardConflict,
  detectSlotConflict,
  formatTokyoShort,
  mondayContaining,
  monthCells,
  nextPrepLine,
  passCurrentStage,
  tokyoDateKey,
} from "./logic";

describe("progress demo logic", () => {
  it("puts Hitachi on document screening", () => {
    const hitachi = SAMPLE_APPLICATIONS.find((app) => app.id === "hitachi");
    expect(hitachi).toBeDefined();
    expect(currentStage(hitachi!)?.kind).toBe("document_screening");
    expect(nextPrepLine(hitachi!)).toBe("書類の準備・提出");
  });

  it("uses handwritten next-prep when present", () => {
    const mercari = SAMPLE_APPLICATIONS.find((app) => app.id === "mercari")!;
    expect(nextPrepLine(mercari)).toBe("一次面接の逆質問を3つ用意する");
  });

  it("formats Tokyo times as month/day hour:minute", () => {
    expect(formatTokyoShort("2026-11-12T14:00:00+09:00")).toBe("11/12 14:00");
  });

  it("flags Mercari vs CyberAgent as a hard conflict", () => {
    expect(applicationHasConflict(
      SAMPLE_APPLICATIONS.find((app) => app.id === "mercari")!,
      SAMPLE_APPLICATIONS,
    )).toBe(true);
    const hit = detectHardConflict(
      SAMPLE_APPLICATIONS,
      "2026-11-12T14:00:00+09:00",
      "2026-11-12T15:00:00+09:00",
      "mercari-i1",
    );
    expect(hit?.otherCompany).toBe("株式会社サイバーエージェント");
  });

  it("advances the current stage on pass", () => {
    const hitachi = SAMPLE_APPLICATIONS.find((app) => app.id === "hitachi")!;
    const next = passCurrentStage(hitachi);
    expect(currentStage(next)?.kind).toBe("aptitude_test");
  });

  it("blocks a proposed slot that overlaps a confirmed interview", () => {
    const hit = detectSlotConflict(
      SAMPLE_APPLICATIONS,
      "2026-11-12T14:15:00+09:00",
      "2026-11-12T15:15:00+09:00",
      { ignoreAppId: "nttdata" },
    );
    expect(hit?.kind).toBe("confirmed");
    expect(hit?.otherCompany).toBe("株式会社メルカリ");
  });

  it("blocks a proposed slot that overlaps another company's proposed window", () => {
    const hit = detectSlotConflict(
      SAMPLE_APPLICATIONS,
      "2026-11-14T10:30:00+09:00",
      "2026-11-14T11:30:00+09:00",
      { ignoreAppId: "nttdata" },
    );
    expect(hit?.kind).toBe("proposed");
    expect(hit?.otherCompany).toBe("パナソニックホールディングス株式会社");
  });

  it("allows a non-overlapping candidate window", () => {
    expect(
      detectSlotConflict(
        SAMPLE_APPLICATIONS,
        "2026-11-20T10:00:00+09:00",
        "2026-11-20T11:00:00+09:00",
        { ignoreAppId: "nttdata" },
      ),
    ).toBeNull();
  });

  it("builds a Monday-first November 2026 grid", () => {
    const cells = monthCells(2026, 10);
    expect(cells[0]?.key).toBe("2026-10-26");
    expect(cells.find((cell) => cell.key === "2026-11-01")?.inMonth).toBe(true);
    expect(tokyoDateKey("2026-11-14T10:00:00+09:00")).toBe("2026-11-14");
  });

  it("paints confirmed and other proposed hours on the week grid", () => {
    expect(cellOccupancy(SAMPLE_APPLICATIONS, "2026-11-12", 14, "nttdata")).toBe(
      "confirmed",
    );
    expect(cellOccupancy(SAMPLE_APPLICATIONS, "2026-11-14", 10, "nttdata")).toBe(
      "proposed",
    );
    expect(cellOccupancy(SAMPLE_APPLICATIONS, "2026-11-14", 15, "nttdata")).toBe(
      "own",
    );
    expect(mondayContaining("2026-11-12")).toBe("2026-11-09");
    expect(defaultFreeSlots(SAMPLE_APPLICATIONS, "nttdata", 3)).toHaveLength(3);
  });
});
