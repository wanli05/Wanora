import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrepBaseTheme } from "@/lib/interview-prep/base-themes";
import { QuestionCard, type QuestionCardLabels } from "./question-card";

const openPanel = vi.fn();

vi.mock("@/components/ai-sidebar/ai-assist-context", () => ({
  useAiAssistOptional: () => ({
    openPanel,
    openWithAssist: vi.fn(),
    invalidateAssistApply: vi.fn(),
    registerOpenHandler: () => () => {},
    registerPanelOpener: () => () => {},
    registerInvalidateHandler: () => () => {},
    registerLegacySlotBinder: () => () => {},
    resolveLegacySlotBinder: () => null,
    bridgeError: null,
    clearBridgeError: vi.fn(),
  }),
}));

const labels: QuestionCardLabels = {
  expand: "詳細を開く",
  collapse: "詳細を閉じる",
  guidanceLabel: "準備のポイント",
  answerHeading: "自分の回答",
  openAiAssist: "AIで回答を作成・修正",
  aiAssistHint: "サイドバーを開きます",
  reflectComingSoon: "反映は今後",
  editorHint: "デモ：入力内容は保存されません",
  editorPlaceholder: "回答を書く",
  aiUnavailable: "AI を開けませんでした",
  successLabel: "成功体験",
  failureLabel: "失敗体験",
  reverseItemLabel: "逆質問",
  addReverseItem: "質問を追加",
  removeReverseItem: "削除",
  reversePlaceholder: "聞きたいこと",
};

const textTheme: PrepBaseTheme = {
  id: "base-motivation",
  title: "志望動機",
  guidance: "接点を整理する",
  answerKind: "text",
};

describe("QuestionCard", () => {
  beforeEach(() => {
    openPanel.mockReset();
    openPanel.mockResolvedValue(true);
  });

  it("expands guidance and answer editor without mock generate", () => {
    render(<QuestionCard theme={textTheme} labels={labels} />);
    fireEvent.click(screen.getByTestId("prep-question-toggle-base-motivation"));
    expect(
      screen.getByTestId("prep-question-details-base-motivation"),
    ).toHaveTextContent("接点を整理する");
    expect(
      screen.getByTestId("prep-editor-input-base-motivation"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("prep-generate-base-motivation"),
    ).not.toBeInTheDocument();
  });

  it("opens AI panel on assist click", async () => {
    const onAiFocus = vi.fn();
    render(
      <QuestionCard
        theme={textTheme}
        labels={labels}
        onAiFocus={onAiFocus}
      />,
    );
    fireEvent.click(screen.getByTestId("prep-question-toggle-base-motivation"));
    fireEvent.click(screen.getByTestId("prep-ai-assist-base-motivation"));
    await waitFor(() => expect(openPanel).toHaveBeenCalledTimes(1));
    expect(onAiFocus).toHaveBeenCalledWith("base-motivation");
  });

  it("supports dual success/failure editors", () => {
    const dual: PrepBaseTheme = {
      id: "base-success-failure",
      title: "成功体験・失敗体験",
      guidance: "分けて書く",
      answerKind: "dual_experience",
    };
    render(<QuestionCard theme={dual} labels={labels} />);
    fireEvent.click(
      screen.getByTestId("prep-question-toggle-base-success-failure"),
    );
    expect(
      screen.getByTestId("prep-editor-success-base-success-failure"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("prep-editor-failure-base-success-failure"),
    ).toBeInTheDocument();
  });

  it("supports multiple reverse questions", () => {
    const reverse: PrepBaseTheme = {
      id: "base-reverse-qa",
      title: "逆質問",
      guidance: "複数用意",
      answerKind: "reverse_qa_list",
    };
    render(<QuestionCard theme={reverse} labels={labels} />);
    fireEvent.click(screen.getByTestId("prep-question-toggle-base-reverse-qa"));
    expect(screen.getByTestId("prep-reverse-item-base-reverse-qa-0")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("prep-reverse-add-base-reverse-qa"));
    expect(screen.getByTestId("prep-reverse-item-base-reverse-qa-1")).toBeInTheDocument();
  });
});
