import { describe, expect, it } from "vitest";
import {
  canCreateFeedback,
  feedbackSummary,
  validateFeedbackContent,
} from "./feedback";
import { ProgressError } from "./errors";

describe("canCreateFeedback", () => {
  it("allows writing after the interview start", () => {
    expect(
      canCreateFeedback({
        interviewStatus: "scheduled",
        startsAt: "2026-11-10T01:00:00.000Z",
        now: new Date("2026-11-11T01:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("blocks writing before the interview start", () => {
    expect(
      canCreateFeedback({
        interviewStatus: "scheduled",
        startsAt: "2026-11-12T01:00:00.000Z",
        now: new Date("2026-11-11T01:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("blocks cancelled interviews", () => {
    expect(
      canCreateFeedback({
        interviewStatus: "cancelled",
        startsAt: "2026-11-10T01:00:00.000Z",
        now: new Date("2026-11-11T01:00:00.000Z"),
      }),
    ).toBe(false);
  });
});

describe("validateFeedbackContent", () => {
  it("requires a non-empty body", () => {
    expect(() => validateFeedbackContent({ body: "  " })).toThrow(ProgressError);
  });

  it("accepts trimmed Japanese body", () => {
    expect(validateFeedbackContent({ body: " 志望動機が弱い " })).toEqual({
      body: "志望動機が弱い",
    });
  });
});

describe("feedbackSummary", () => {
  it("builds a short card label", () => {
    expect(
      feedbackSummary({
        source: "company",
        body: "志望動機をもっと深掘りしてほしい",
      }),
    ).toBe("会社 · 志望動機をもっと深掘りしてほしい");
  });
});
