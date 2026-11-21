import { describe, expect, it } from "vitest";
import type { BoardApplication, BoardStageInterview } from "@/lib/progress/dto";
import {
  buildPrepRounds,
  pickDefaultRoundId,
  stageForTest,
  summarizeRoundSchedule,
} from "./rounds";

function baseApp(
  overrides: Partial<BoardApplication> &
    Pick<BoardApplication, "id" | "stages" | "stageInterviews">,
): BoardApplication {
  return {
    company: "株式会社テスト",
    companyId: "co-1",
    companyUrl: null,
    companyNotes: null,
    role: "エンジニア",
    platformId: "p-1",
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
    currentStageId: "st-doc",
    conflict: false,
    interview: null,
    proposal: null,
    ...overrides,
  };
}

function interview(
  partial: Partial<BoardStageInterview> &
    Pick<BoardStageInterview, "id" | "stageId" | "stageKind" | "start">,
): BoardStageInterview {
  return {
    end: partial.end ?? partial.start,
    mode: "google_meet",
    meetingUrl: null,
    locationText: null,
    status: "scheduled",
    interviewers: null,
    canWriteFeedback: false,
    feedbacks: [],
    ...partial,
  };
}

describe("buildPrepRounds", () => {
  it("includes interview-capable stages without inventing interviews", () => {
    const app = baseApp({
      id: "app-1",
      stages: [
        stageForTest({
          id: "st-doc",
          kind: "document_screening",
          position: 0,
          status: "passed",
        }),
        stageForTest({
          id: "st-i1",
          kind: "interview_1",
          position: 1,
          status: "pending",
        }),
        stageForTest({
          id: "st-i2",
          kind: "interview_2",
          position: 2,
          status: "skipped",
        }),
      ],
      stageInterviews: [],
    });

    const rounds = buildPrepRounds(app);
    expect(rounds).toHaveLength(1);
    expect(rounds[0]?.stageId).toBe("st-i1");
    expect(rounds[0]?.schedulePending).toBe(true);
    expect(rounds[0]?.interviews).toEqual([]);
  });
});

describe("pickDefaultRoundId", () => {
  it("prefers the stage with the next upcoming interview", () => {
    const rounds = buildPrepRounds(
      baseApp({
        id: "app-1",
        currentStageId: "st-i1",
        currentStageKind: "interview_1",
        stages: [
          stageForTest({
            id: "st-i1",
            kind: "interview_1",
            position: 1,
            status: "scheduled",
          }),
          stageForTest({
            id: "st-final",
            kind: "interview_final",
            position: 2,
            status: "pending",
          }),
        ],
        stageInterviews: [
          interview({
            id: "iv-past",
            stageId: "st-i1",
            stageKind: "interview_1",
            start: "2026-11-01T10:00:00.000Z",
            status: "scheduled",
          }),
          interview({
            id: "iv-next",
            stageId: "st-final",
            stageKind: "interview_final",
            start: "2026-12-01T10:00:00.000Z",
            status: "scheduled",
          }),
        ],
      }),
    );

    expect(
      pickDefaultRoundId(rounds, { currentStageId: "st-i1" }, new Date("2026-11-15T00:00:00.000Z")),
    ).toBe("st-final");
  });

  it("falls back to current stage then first round when nothing is scheduled", () => {
    const rounds = buildPrepRounds(
      baseApp({
        id: "app-1",
        currentStageId: "st-i1",
        currentStageKind: "interview_1",
        stages: [
          stageForTest({
            id: "st-i1",
            kind: "interview_1",
            position: 1,
            status: "pending",
          }),
          stageForTest({
            id: "st-final",
            kind: "interview_final",
            position: 2,
            status: "pending",
          }),
        ],
        stageInterviews: [],
      }),
    );

    expect(pickDefaultRoundId(rounds, { currentStageId: "st-i1" })).toBe("st-i1");
    expect(pickDefaultRoundId(rounds, { currentStageId: null })).toBe("st-i1");
  });
});

describe("summarizeRoundSchedule", () => {
  it("reports unscheduled when there is no active interview", () => {
    const rounds = buildPrepRounds(
      baseApp({
        id: "app-1",
        stages: [
          stageForTest({
            id: "st-i1",
            kind: "interview_1",
            position: 1,
            status: "pending",
          }),
        ],
        stageInterviews: [],
      }),
    );
    expect(summarizeRoundSchedule(rounds[0] ?? null).kind).toBe("unscheduled");
  });
});
