import { describe, expect, it } from "vitest";
import {
  findMockQuestion,
  mockQuestionsForStage,
} from "./mock-pack";

describe("mockQuestionsForStage", () => {
  it("returns Japanese fixtures with intent, points, and sample for interview_1", () => {
    const list = mockQuestionsForStage("interview_1");
    expect(list.length).toBeGreaterThanOrEqual(3);
    for (const item of list) {
      expect(item.question.length).toBeGreaterThan(0);
      expect(item.intent.length).toBeGreaterThan(0);
      expect(item.points.length).toBeGreaterThan(0);
      expect(item.sampleAnswer.length).toBeGreaterThan(0);
    }
  });

  it("still returns questions when stage kind is unknown (面接未定 fallback)", () => {
    expect(mockQuestionsForStage(null).length).toBeGreaterThan(0);
    expect(mockQuestionsForStage("document_screening").length).toBeGreaterThan(
      0,
    );
  });

  it("keeps different packs per major interview kind", () => {
    const first = mockQuestionsForStage("interview_1").map((q) => q.id);
    const final = mockQuestionsForStage("interview_final").map((q) => q.id);
    expect(final).toContain("final-offer");
    expect(first).not.toContain("final-offer");
  });
});

describe("findMockQuestion", () => {
  it("finds by id within a stage pack", () => {
    const found = findMockQuestion("interview_1", "common-motivation");
    expect(found?.question).toContain("志望動機");
  });

  it("returns null for unknown id", () => {
    expect(findMockQuestion("interview_1", "missing")).toBeNull();
  });
});
