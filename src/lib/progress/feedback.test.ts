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
  it("requires at least one content field", () => {
    expect(() => validateFeedbackContent({ body: "  " })).toThrow(ProgressError);
    expect(() =>
      validateFeedbackContent({
        body: null,
        question: null,
        ownAnswer: null,
        resultText: null,
        reflection: null,
      }),
    ).toThrow(ProgressError);
  });

  it("accepts trimmed Japanese body", () => {
    expect(validateFeedbackContent({ body: " 志望動機が弱い " })).toEqual({
      body: "志望動機が弱い",
      question: null,
      ownAnswer: null,
      resultText: null,
      reflection: null,
    });
  });

  it("accepts structured fields without body", () => {
    expect(
      validateFeedbackContent({
        question: " 自己紹介してください ",
        ownAnswer: "大学で…",
        resultText: "通過",
        reflection: "もっと短く",
      }),
    ).toEqual({
      body: null,
      question: "自己紹介してください",
      ownAnswer: "大学で…",
      resultText: "通過",
      reflection: "もっと短く",
    });
  });
});

describe("feedbackSummary", () => {
  it("builds a short card label from body", () => {
    expect(
      feedbackSummary({
        source: "company",
        body: "志望動機をもっと深掘りしてほしい",
      }),
    ).toBe("会社 · 志望動機をもっと深掘りしてほしい");
  });

  it("falls back to question when body is empty", () => {
    expect(
      feedbackSummary({
        source: "self",
        question: "なぜ当社ですか？",
      }),
    ).toBe("自分 · なぜ当社ですか？");
  });
});
