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
  it("requires body or rating", () => {
    expect(() => validateFeedbackContent({ body: "  ", rating: null })).toThrow(
      ProgressError,
    );
  });

  it("accepts rating-only feedback", () => {
    expect(validateFeedbackContent({ body: null, rating: 4 })).toEqual({
      body: null,
      rating: 4,
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
