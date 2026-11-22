import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MockPrepQuestion } from "@/lib/interview-prep/mock-pack";
import { QuestionCard } from "./question-card";

const openPanel = vi.fn();

vi.mock("@/components/ai-sidebar/ai-assist-context", () => ({
  useAiAssistOptional: () => ({
    openPanel,
    openWithAssist: vi.fn(),
    invalidateAssistApply: vi.fn(),
    registerOpenHandler: () => () => {},
    registerPanelOpener: () => () => {},
    registerInvalidateHandler: () => () => {},
    bridgeError: null,
    clearBridgeError: vi.fn(),
  }),
}));

const labels = {
  intent: "質問の意図",
  points: "回答のポイント",
  expand: "詳細を開く",
  collapse: "詳細を閉じる",
  demoBadge: "デモ",
  answerHeading: "自分の回答",
  openAiAssist: "AIで回答を作成・修正",
  aiAssistHint: "サイドバーを開きます",
  reflectComingSoon: "反映は今後",
  editorHint: "デモ：入力内容は保存されません",
  editorPlaceholder: "ここに自分の回答を書いてください",
  aiUnavailable: "AI を開けませんでした",
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
    openPanel.mockReset();
    openPanel.mockResolvedValue(true);
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

  it("shows answer editor without mock generate controls", () => {
    render(<QuestionCard question={question} labels={labels} />);
    fireEvent.click(screen.getByTestId("prep-question-toggle-q-1"));
    expect(screen.getByTestId("prep-answer-section-q-1")).toBeInTheDocument();
    expect(screen.getByTestId("prep-editor-input-q-1")).toBeInTheDocument();
    expect(screen.getByTestId("prep-ai-assist-q-1")).toHaveTextContent(
      "AIで回答を作成・修正",
    );
    expect(screen.queryByTestId("prep-generate-q-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("prep-sample-q-1")).not.toBeInTheDocument();
    expect(screen.getByText("デモ：入力内容は保存されません")).toBeInTheDocument();
  });

  it("lets the user edit the answer field without save-success copy", () => {
    render(<QuestionCard question={question} labels={labels} />);
    fireEvent.click(screen.getByTestId("prep-question-toggle-q-1"));
    fireEvent.change(screen.getByTestId("prep-editor-input-q-1"), {
      target: { value: "ユーザー編集後の回答" },
    });
    expect(screen.getByTestId("prep-editor-input-q-1")).toHaveValue(
      "ユーザー編集後の回答",
    );
    expect(screen.queryByText("保存しました")).not.toBeInTheDocument();
  });

  it("opens the shared AI panel and reports focus", async () => {
    const onAiFocus = vi.fn();
    render(
      <QuestionCard
        question={question}
        labels={labels}
        onAiFocus={onAiFocus}
        aiFocused
      />,
    );
    fireEvent.click(screen.getByTestId("prep-question-toggle-q-1"));
    fireEvent.click(screen.getByTestId("prep-ai-assist-q-1"));
    await waitFor(() => expect(openPanel).toHaveBeenCalledTimes(1));
    expect(onAiFocus).toHaveBeenCalledWith("q-1");
    expect(screen.getByTestId("prep-question-q-1")).toHaveAttribute(
      "data-ai-focused",
      "true",
    );
  });

  it("shows unavailable copy when openPanel fails", async () => {
    openPanel.mockResolvedValue(false);
    render(<QuestionCard question={question} labels={labels} />);
    fireEvent.click(screen.getByTestId("prep-question-toggle-q-1"));
    fireEvent.click(screen.getByTestId("prep-ai-assist-q-1"));
    await waitFor(() =>
      expect(screen.getByTestId("prep-ai-unavailable-q-1")).toBeInTheDocument(),
    );
  });
});
