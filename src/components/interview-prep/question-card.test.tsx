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
  regenerate: "回答例を再生成",
  sampleHeading: "回答例（デモ）",
  generateError: "回答例を表示できませんでした。",
  demoBadge: "デモ",
  editAnswer: "回答を編集",
  finishEdit: "編集を完了（デモ）",
  cancelEdit: "編集をやめる",
  draftHeading: "あなたの回答（デモ）",
  editorHint: "デモ：入力内容は保存されません",
  editorPlaceholder: "ここに自分の回答を書いてください",
};

const question: MockPrepQuestion = {
  id: "q-1",
  question: "志望動機を教えてください。",
  intent: "意図テキスト",
  points: ["ポイントA", "ポイントB"],
  sampleAnswer: "サンプル回答本文",
};

function generateReady() {
  fireEvent.click(screen.getByTestId("prep-generate-q-1"));
  act(() => {
    vi.runAllTimers();
  });
}

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
  });

  it("moves idle → loading → ready for mock sample answer", () => {
    render(<QuestionCard question={question} labels={labels} />);
    const card = screen.getByTestId("prep-question-q-1");
    fireEvent.click(screen.getByTestId("prep-generate-q-1"));
    expect(card).toHaveAttribute("data-answer-state", "loading");
    act(() => {
      vi.runAllTimers();
    });
    expect(card).toHaveAttribute("data-answer-state", "ready");
    expect(screen.getByTestId("prep-sample-q-1")).toHaveTextContent(
      "サンプル回答本文",
    );
  });

  it("opens editor seeded from sample and commits draft without save success copy", () => {
    render(<QuestionCard question={question} labels={labels} />);
    generateReady();
    fireEvent.click(screen.getByTestId("prep-edit-q-1"));
    const input = screen.getByTestId("prep-editor-input-q-1");
    expect(input).toHaveValue("サンプル回答本文");
    expect(screen.getByTestId("prep-editor-q-1")).toHaveTextContent(
      "デモ：入力内容は保存されません",
    );
    fireEvent.change(input, { target: { value: "ユーザー編集後の回答" } });
    fireEvent.click(screen.getByTestId("prep-editor-finish-q-1"));
    expect(screen.getByTestId("prep-draft-q-1")).toHaveTextContent(
      "ユーザー編集後の回答",
    );
    expect(screen.queryByText("保存しました")).not.toBeInTheDocument();
  });

  it("cancel restores the draft from before edit", () => {
    render(<QuestionCard question={question} labels={labels} />);
    generateReady();
    fireEvent.click(screen.getByTestId("prep-edit-q-1"));
    fireEvent.change(screen.getByTestId("prep-editor-input-q-1"), {
      target: { value: "初回ドラフト" },
    });
    fireEvent.click(screen.getByTestId("prep-editor-finish-q-1"));
    expect(screen.getByTestId("prep-draft-q-1")).toHaveTextContent("初回ドラフト");

    fireEvent.click(screen.getByTestId("prep-edit-q-1"));
    fireEvent.change(screen.getByTestId("prep-editor-input-q-1"), {
      target: { value: "破棄される編集" },
    });
    fireEvent.click(screen.getByTestId("prep-editor-cancel-q-1"));
    expect(screen.getByTestId("prep-draft-q-1")).toHaveTextContent("初回ドラフト");
    expect(screen.queryByTestId("prep-editor-q-1")).not.toBeInTheDocument();
  });

  it("regenerating mock sample does not overwrite the user draft", () => {
    render(<QuestionCard question={question} labels={labels} />);
    generateReady();
    fireEvent.click(screen.getByTestId("prep-edit-q-1"));
    fireEvent.change(screen.getByTestId("prep-editor-input-q-1"), {
      target: { value: "守られるドラフト" },
    });
    fireEvent.click(screen.getByTestId("prep-editor-finish-q-1"));

    fireEvent.click(screen.getByTestId("prep-generate-again-q-1"));
    act(() => {
      vi.runAllTimers();
    });
    expect(screen.getByTestId("prep-sample-q-1")).toHaveTextContent(
      "サンプル回答本文",
    );
    expect(screen.getByTestId("prep-draft-q-1")).toHaveTextContent(
      "守られるドラフト",
    );
  });
});
