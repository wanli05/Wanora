import { describe, expect, it } from "vitest";
import { deriveNextPrep } from "./next-prep";
import { midCareerStages, type StageSnapshot } from "./stages";

function stages(): StageSnapshot[] {
  return midCareerStages().map((stage, index) => ({
    id: `s-${index}`,
    kind: stage.kind,
    customLabel: null,
    position: stage.position,
    status: stage.status,
    deadlineAt: null,
  }));
}

describe("deriveNextPrep", () => {
  it("uses handwritten override on the card", () => {
    const result = deriveNextPrep({
      nextPrepNote: "一次面接の逆質問を3つ用意する",
      stages: stages(),
      outcome: "in_progress",
      offerDecision: null,
      interviews: [],
      proposal: null,
    });
    expect(result.display).toBe("一次面接の逆質問を3つ用意する");
    expect(result.derived).toBe("書類の準備・提出");
  });

  it("uses the stage name when an interview is scheduled", () => {
    const list = stages().map((stage) => {
      if (stage.kind === "document_screening" || stage.kind === "aptitude_test") {
        return { ...stage, status: "passed" as const };
      }
      if (stage.kind === "interview_1") {
        return { ...stage, status: "scheduled" as const };
      }
      return stage;
    });
    const result = deriveNextPrep({
      nextPrepNote: null,
      stages: list,
      outcome: "in_progress",
      offerDecision: null,
      interviews: [
        {
          start: "2026-11-12T14:00:00+09:00",
          end: "2026-11-12T15:00:00+09:00",
          mode: "google_meet",
          status: "scheduled",
        },
      ],
      proposal: null,
      now: new Date("2026-11-04T12:00:00+09:00"),
    });
    expect(result.display).toBe("一次面接");
  });

  it("uses the stage name without の準備 when interview is not yet set", () => {
    const list = stages().map((stage) => {
      if (stage.kind === "document_screening" || stage.kind === "aptitude_test") {
        return { ...stage, status: "passed" as const };
      }
      if (stage.kind === "interview_1") {
        return { ...stage, status: "pending" as const };
      }
      return stage;
    });
    const result = deriveNextPrep({
      nextPrepNote: null,
      stages: list,
      outcome: "in_progress",
      offerDecision: null,
      interviews: [],
      proposal: null,
    });
    expect(result.display).toBe("一次面接");
  });

  it("waits for a sent proposal", () => {
    const result = deriveNextPrep({
      nextPrepNote: null,
      stages: stages(),
      outcome: "in_progress",
      offerDecision: null,
      interviews: [],
      proposal: {
        status: "sent",
        replyDeadlineAt: "2026-11-10T00:00:00+09:00",
        slotCount: 3,
      },
    });
    expect(result.display).toBe("候補日程の返信待ち（期限 11/10）");
  });

  it("prompts submitting a draft proposal", () => {
    const result = deriveNextPrep({
      nextPrepNote: null,
      stages: stages(),
      outcome: "in_progress",
      offerDecision: null,
      interviews: [],
      proposal: { status: "draft", replyDeadlineAt: null, slotCount: 2 },
    });
    expect(result.display).toBe("候補日程を提出する");
  });
});
