import { describe, expect, it } from "vitest";
import {
  findMockQuestion,
  mockQuestionsForStage,
} from "./mock-pack";

describe("mockQuestionsForStage (base themes)", () => {
  it("always returns the seven base themes regardless of stage", () => {
    for (const kind of [
      null,
      "interview_1",
      "interview_final",
      "document_screening",
    ] as const) {
      const list = mockQuestionsForStage(kind);
      expect(list).toHaveLength(7);
      expect(list.map((q) => q.id)).toEqual([
        "base-self-intro",
        "base-self-pr",
        "base-career-change",
        "base-motivation",
        "base-career-design",
        "base-success-failure",
        "base-reverse-qa",
      ]);
    }
  });

  it("finds base themes by stable id", () => {
    expect(findMockQuestion(null, "base-motivation")?.question).toBe(
      "志望動機",
    );
    expect(findMockQuestion("interview_1", "missing")).toBeNull();
  });
});
