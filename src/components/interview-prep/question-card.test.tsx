import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockPrepQuestion } from "@/lib/interview-prep/mock-pack";
import { QuestionCard } from "./question-card";

const labels = {
  intent: "質問の意図",
  points: "回答のポイント",
  expand: "詳細を開く",
  collapse: "詳細を閉じる",
  generate: "AI回答例を生成",
  generating: "生成中…",
  retry: "再試行",
  sampleHeading: "回答例（デモ）",
  generateError: "回答例を表示できませんでした。",
  demoBadge: "デモ",
};

const question: MockPrepQuestion = {
  id: "q-1",
  question: "志望動機を教えてください。",
  intent: "意図テキスト",
  points: ["ポイントA", "ポイントB"],
  sampleAnswer: "サンプル回答本文",
};

describe("QuestionCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps details collapsed until expanded", () => {
    render(<QuestionCard question={question} labels={labels} />);
    expect(
      screen.queryByTestId("prep-question-details-q-1"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("prep-question-toggle-q-1"));
    expect(screen.getByTestId("prep-question-details-q-1")).toHaveTextContent(
      "意図テキスト",
    );
    expect(screen.getByTestId("prep-question-details-q-1")).toHaveTextContent(
      "ポイントA",
    );
  });

  it("moves idle → loading → ready for mock sample answer", () => {
    render(<QuestionCard question={question} labels={labels} />);
    const card = screen.getByTestId("prep-question-q-1");
    expect(card).toHaveAttribute("data-answer-state", "idle");

    fireEvent.click(screen.getByTestId("prep-generate-q-1"));
    expect(card).toHaveAttribute("data-answer-state", "loading");
    expect(screen.getByTestId("prep-generate-loading-q-1")).toBeDisabled();

    act(() => {
      vi.runAllTimers();
    });
    expect(card).toHaveAttribute("data-answer-state", "ready");
    expect(screen.getByTestId("prep-sample-q-1")).toHaveTextContent(
      "サンプル回答本文",
    );
  });

  it("shows error when sample answer is missing", () => {
    render(
      <QuestionCard
        question={{ ...question, sampleAnswer: "   " }}
        labels={labels}
      />,
    );
    fireEvent.click(screen.getByTestId("prep-generate-q-1"));
    act(() => {
      vi.runAllTimers();
    });
    expect(screen.getByTestId("prep-question-q-1")).toHaveAttribute(
      "data-answer-state",
      "error",
    );
    expect(screen.getByTestId("prep-generate-error-q-1")).toBeInTheDocument();
  });
});
