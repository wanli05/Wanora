import { describe, expect, it } from "vitest";
import type { BoardApplication } from "./dto";
import { appTaskFlags, countTaskFocus } from "./task-focus";

function base(overrides: Partial<BoardApplication> = {}): BoardApplication {
  return {
    id: "a1",
    company: "Co",
    companyId: "c1",
    companyUrl: null,
    companyNotes: null,
    role: null,
    platformId: "p1",
    platformCode: "doda",
    platformName: null,
    recruiterId: null,
    recruiterName: null,
    appliedOn: "2026-11-01",
    jobPosting: {
      jobUrl: null,
      salaryBandText: null,
      benefitsText: null,
      jdText: null,
      processNotes: null,
      workLocationText: null,
      jobNotes: null,
    },
    hasJobPosting: false,
    hasFeedback: false,
    outcome: "in_progress",
    offerDecision: null,
    nextPrepNote: null,
    nextPrep: "",
    derivedNextPrep: "",
    currentStageKind: "document_screening",
    currentStageId: "s1",
    conflict: false,
    interview: null,
    stageInterviews: [],
    proposal: null,
    stages: [],
    ...overrides,
  };
}

describe("task-focus", () => {
  it("flags document screening without interview as waiting", () => {
    expect(appTaskFlags(base(), Date.parse("2026-11-14T00:00:00Z")).waiting).toBe(
      true,
    );
  });

  it("still flags overlap for conflict badges without counting it in summary", () => {
    const now = Date.parse("2026-11-14T00:00:00Z");
    expect(appTaskFlags(base({ conflict: true }), now).overlap).toBe(true);
    expect(countTaskFocus([base({ conflict: true })], now)).toEqual({
      interview: 0,
      waiting: 1,
      overdue: 0,
    });
  });
});
