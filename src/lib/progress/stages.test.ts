import { describe, expect, it } from "vitest";
import {
  allowedAdvanceActions,
  currentStage,
  isAdvanceActionAllowed,
  isClosed,
  jumpToOffer,
  midCareerStages,
  outcomeAfterStages,
  passStages,
  skipStages,
  visibleBoardColumns,
  type StageSnapshot,
} from "./stages";

function asSnapshots(): StageSnapshot[] {
  return midCareerStages().map((stage, index) => ({
    id: `s-${index}`,
    kind: stage.kind,
    customLabel: null,
    position: stage.position,
    status: stage.status,
    deadlineAt: null,
  }));
}

describe("mid-career stages", () => {
  it("skips info session and second interview", () => {
    const stages = asSnapshots();
    expect(stages.find((s) => s.kind === "info_session")?.status).toBe("skipped");
    expect(stages.find((s) => s.kind === "interview_2")?.status).toBe("skipped");
    expect(currentStage(stages, "in_progress", null)?.kind).toBe(
      "document_screening",
    );
  });

  it("places aptitude after documents and before first interview", () => {
    const kinds = asSnapshots()
      .filter((s) => s.status !== "skipped")
      .map((s) => s.kind);
    expect(kinds).toEqual([
      "document_screening",
      "aptitude_test",
      "interview_1",
      "interview_final",
      "offer",
    ]);
  });

  it("advances to aptitude after passing documents", () => {
    const next = passStages(asSnapshots());
    expect(currentStage(next, "in_progress", null)?.kind).toBe("aptitude_test");
  });

  it("skip also advances", () => {
    const next = skipStages(asSnapshots());
    expect(currentStage(next, "in_progress", null)?.kind).toBe("aptitude_test");
  });

  it("marks remaining stages skipped when jumping to offer", () => {
    const next = jumpToOffer(asSnapshots());
    expect(next.find((s) => s.kind === "document_screening")?.status).toBe(
      "skipped",
    );
    expect(outcomeAfterStages(next, "in_progress")).toEqual({
      outcome: "offer",
      offerDecision: "pending",
    });
  });

  it("hides screening/offer buttons that do not belong on the stage", () => {
    expect(allowedAdvanceActions("info_session")).toEqual(["pass"]);
    expect(isAdvanceActionAllowed("info_session", "skip")).toBe(false);
    expect(isAdvanceActionAllowed("info_session", "reject")).toBe(false);
    expect(isAdvanceActionAllowed("info_session", "offer")).toBe(false);
    expect(isAdvanceActionAllowed("info_session", "withdraw")).toBe(false);

    expect(allowedAdvanceActions("document_screening")).toEqual([
      "pass",
      "reject",
      "withdraw",
    ]);
    expect(isAdvanceActionAllowed("document_screening", "skip")).toBe(false);
    expect(isAdvanceActionAllowed("document_screening", "offer")).toBe(false);
    expect(isAdvanceActionAllowed("interview_1", "offer")).toBe(false);
    expect(isAdvanceActionAllowed("interview_2", "offer")).toBe(false);

    expect(allowedAdvanceActions("interview_final")).toEqual([
      "pass",
      "reject",
      "offer",
    ]);
    expect(isAdvanceActionAllowed("interview_final", "skip")).toBe(false);
    expect(isAdvanceActionAllowed("interview_final", "withdraw")).toBe(false);
  });

  it("hides the info-session column until an in-progress card is there", () => {
    expect(visibleBoardColumns([])).not.toContain("info_session");
    expect(
      visibleBoardColumns([
        {
          currentStageKind: "document_screening",
          outcome: "in_progress",
          offerDecision: null,
        },
      ]),
    ).not.toContain("info_session");
    expect(
      visibleBoardColumns([
        {
          currentStageKind: "info_session",
          outcome: "rejected",
          offerDecision: null,
        },
      ]),
    ).not.toContain("info_session");
    expect(
      visibleBoardColumns([
        {
          currentStageKind: "info_session",
          outcome: "in_progress",
          offerDecision: null,
        },
      ]),
    ).toContain("info_session");
  });

  it("treats accepted/declined offers as closed", () => {
    expect(isClosed("offer", "accepted")).toBe(true);
    expect(isClosed("offer", "pending")).toBe(false);
    expect(isClosed("rejected", null)).toBe(true);
  });
});
