import { describe, expect, it } from "vitest";
import { SAMPLE_APPLICATIONS } from "./fixtures";
import {
  applicationHasConflict,
  currentStage,
  detectHardConflict,
  formatTokyoShort,
  nextPrepLine,
  passCurrentStage,
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
});
