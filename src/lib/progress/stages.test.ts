import { describe, expect, it } from "vitest";
import {
  currentStage,
  isClosed,
  jumpToOffer,
  midCareerStages,
  outcomeAfterStages,
  passStages,
  skipStages,
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

  it("treats accepted/declined offers as closed", () => {
    expect(isClosed("offer", "accepted")).toBe(true);
    expect(isClosed("offer", "pending")).toBe(false);
    expect(isClosed("rejected", null)).toBe(true);
  });
});
