import { describe, expect, it } from "vitest";
import {
  mirrorQaToLegacy,
  normalizeQaItems,
  resolveQaItems,
} from "./qa-items";

describe("qa-items", () => {
  it("resolves legacy question/ownAnswer when qaItems empty", () => {
    expect(
      resolveQaItems({
        qaItems: [],
        question: " 強みは？ ",
        ownAnswer: "粘り強さ",
      }),
    ).toEqual([{ question: "強みは？", answer: "粘り強さ" }]);
  });

  it("prefers qaItems over legacy when both present", () => {
    expect(
      resolveQaItems({
        qaItems: [
          { question: "A", answer: "1" },
          { question: "B", answer: "2" },
        ],
        question: "旧",
        ownAnswer: "旧答",
      }),
    ).toEqual([
      { question: "A", answer: "1" },
      { question: "B", answer: "2" },
    ]);
  });

  it("mirrors first block into legacy columns for reversible writes", () => {
    expect(
      mirrorQaToLegacy([
        { question: "Q1", answer: "A1" },
        { question: "Q2", answer: "A2" },
      ]),
    ).toEqual({
      qaItems: [
        { question: "Q1", answer: "A1" },
        { question: "Q2", answer: "A2" },
      ],
      question: "Q1",
      ownAnswer: "A1",
    });
  });

  it("drops empty blocks", () => {
    expect(
      normalizeQaItems([
        { question: "", answer: "  " },
        { question: "残る", answer: null },
      ]),
    ).toEqual([{ question: "残る", answer: null }]);
  });
});
