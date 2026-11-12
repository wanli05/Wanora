import { describe, expect, it } from "vitest";
import {
  parseFeedbackDeleteBody,
  parseFeedbackUpsertBody,
} from "./feedback-api";

const base = {
  interviewId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  source: "company" as const,
  body: "志望動機が弱い",
  recordedOn: "2026-11-12",
};

describe("parseFeedbackUpsertBody", () => {
  it("accepts append payloads without feedbackId", () => {
    const parsed = parseFeedbackUpsertBody(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.feedbackId).toBeUndefined();
      expect(parsed.data.body).toBe("志望動機が弱い");
    }
  });

  it("treats feedbackId null as append (not invalid_body)", () => {
    const parsed = parseFeedbackUpsertBody({ ...base, feedbackId: null });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.feedbackId).toBeNull();
    }
  });

  it("strips legacy rating instead of rejecting with unrecognized_keys", () => {
    const parsed = parseFeedbackUpsertBody({ ...base, rating: null });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect("rating" in parsed.data).toBe(false);
    }
  });

  it("requires a non-empty body", () => {
    expect(parseFeedbackUpsertBody({ ...base, body: "  " }).success).toBe(false);
  });
});

describe("parseFeedbackDeleteBody", () => {
  it("requires feedbackId", () => {
    expect(parseFeedbackDeleteBody({}).success).toBe(false);
    expect(
      parseFeedbackDeleteBody({
        feedbackId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      }).success,
    ).toBe(true);
  });
});
