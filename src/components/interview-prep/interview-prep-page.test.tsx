import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import type { InterviewPrepApplication } from "@/lib/interview-prep/types";
import {
  InterviewPrepPage,
  InterviewPrepUnavailable,
} from "./interview-prep-page";

const openPanel = vi.fn().mockResolvedValue(true);

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

const messages = {
  InterviewPrep: {
    title: "面接準備",
    backToBoard: "応募進捗に戻る",
    roleUnset: "職種未設定",
    roundLabel: "面接ラウンド",
    scheduleUnscheduled: "面接未定",
    scheduleKnown: "{when} · {mode}",
    scheduleHint: "ヒント",
    noInterviewStages: "段階なし",
    baseQuestionsHeading: "基本質問",
    customQuestionsHeading: "追加質問",
    customQuestionsHint: "追加ヒント",
    customEmpty: "まだ追加質問はありません。",
    customEmptyHint: "質問文を入力してください。",
    customDemoHint: "デモ：この追加は画面上のみです。データベースには保存されません。",
    customGuidance: "この質問への回答を整理します。",
    customInputPlaceholder: "追加したい質問を入力",
    addQuestion: "質問を追加",
    removeCustomQuestion: "削除",
    aiSuggestQuestions: "AIで質問を提案",
    aiSuggestPending: "提案の選択は今後",
    demoNotice: "デモ通知",
    roundSwitchHint: "ラウンド切替で失われます",
    guidanceLabel: "準備のポイント",
    expandDetails: "詳細を開く",
    collapseDetails: "詳細を閉じる",
    answerHeading: "自分の回答",
    openAiAssist: "AIで回答を作成・修正",
    aiAssistHint: "サイドバー",
    reflectComingSoon: "反映は今後",
    editorHint: "デモ：入力内容は保存されません",
    editorPlaceholder: "回答",
    aiUnavailable: "開けません",
    successLabel: "成功体験",
    failureLabel: "失敗体験",
    reverseItemLabel: "逆質問",
    addReverseItem: "質問を追加",
    removeReverseItem: "削除",
    reversePlaceholder: "聞きたいこと",
    referHeading: "参照情報",
    referHint: "未接続",
    referCareer: "職務経歴・プロジェクト",
    referJob: "応募先の求人情報",
    referCompany: "企業情報",
    referHistory: "過去の面接記録・フィードバック",
    referStatusUnused: "未接続",
    referStatusMissing: "資料不足",
    referStatusUnavailable: "取得失敗",
    notFoundTitle: "応募が見つかりません",
    notFoundBody: "ない",
    signedOutTitle: "ログインが必要です",
    signedOutBody: "ログイン",
    goSignIn: "ログインへ",
    loading: "読み込み中…",
  },
};

function renderPrep(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="ja" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const sample: InterviewPrepApplication = {
  id: "app-1",
  company: "株式会社サンプル",
  role: "プロダクトエンジニア",
  companyNotes: null,
  jobPosting: {
    jobUrl: null,
    salaryBandText: null,
    benefitsText: null,
    jdText: null,
    processNotes: null,
    workLocationText: null,
    jobNotes: null,
  },
  currentStageKind: "interview_1",
  currentStageId: "st-i1",
  initialRoundId: "st-i1",
  rounds: [
    {
      stageId: "st-i1",
      stageKind: "interview_1",
      customLabel: null,
      status: "pending",
      label: "一次面接",
      interviews: [],
      schedulePending: true,
    },
    {
      stageId: "st-final",
      stageKind: "interview_final",
      customLabel: null,
      status: "pending",
      label: "最終面接",
      interviews: [],
      schedulePending: true,
    },
  ],
};

describe("InterviewPrepPage UI v2", () => {
  it("shows seven base themes and refer unused status", () => {
    renderPrep(<InterviewPrepPage application={sample} />);
    expect(screen.getByTestId("prep-questions")).toHaveAttribute(
      "data-base-count",
      "7",
    );
    expect(screen.getByTestId("prep-question-base-self-intro")).toBeInTheDocument();
    expect(screen.getByTestId("prep-question-base-reverse-qa")).toBeInTheDocument();
    expect(screen.getByTestId("prep-refer-career")).toHaveAttribute(
      "data-status",
      "unused",
    );
    expect(screen.getAllByText("未接続").length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByText("参照済み")).not.toBeInTheDocument();
    expect(screen.queryByText("準備完了")).not.toBeInTheDocument();
  });

  it("adds a custom question as client demo only", () => {
    renderPrep(<InterviewPrepPage application={sample} />);
    fireEvent.change(screen.getByTestId("prep-custom-input"), {
      target: { value: "チームのオンボーディングはどうですか。" },
    });
    fireEvent.click(screen.getByTestId("prep-custom-add"));
    expect(screen.getByTestId("prep-custom-demo-hint")).toHaveTextContent(
      "データベースには保存されません",
    );
    expect(
      screen.getByText("チームのオンボーディングはどうですか。"),
    ).toBeInTheDocument();
  });

  it("removes a custom question from the demo list", () => {
    renderPrep(<InterviewPrepPage application={sample} />);
    fireEvent.change(screen.getByTestId("prep-custom-input"), {
      target: { value: "削除対象の質問" },
    });
    fireEvent.click(screen.getByTestId("prep-custom-add"));
    const remove = document.querySelector(
      '[data-testid^="prep-custom-remove-custom-"]',
    );
    expect(remove).toBeTruthy();
    fireEvent.click(remove!);
    expect(screen.queryByText("削除対象の質問")).not.toBeInTheDocument();
    expect(screen.getByTestId("prep-custom-empty")).toBeInTheDocument();
  });

  it("opens sidebar from AI suggest without claiming save", async () => {
    renderPrep(<InterviewPrepPage application={sample} />);
    fireEvent.click(screen.getByTestId("prep-custom-ai-suggest"));
    await waitFor(() => expect(openPanel).toHaveBeenCalled());
    expect(screen.getByText("提案の選択は今後")).toBeInTheDocument();
  });

  it("keeps answers isolated across round remount", () => {
    renderPrep(<InterviewPrepPage application={sample} />);
    fireEvent.click(screen.getByTestId("prep-question-toggle-base-motivation"));
    fireEvent.change(screen.getByTestId("prep-editor-input-base-motivation"), {
      target: { value: "動機ドラフト" },
    });
    fireEvent.change(screen.getByTestId("prep-round-select"), {
      target: { value: "st-final" },
    });
    fireEvent.click(screen.getByTestId("prep-question-toggle-base-motivation"));
    expect(screen.getByTestId("prep-editor-input-base-motivation")).toHaveValue(
      "",
    );
  });

  it("renders not-found shell linking to progress", () => {
    renderPrep(<InterviewPrepUnavailable kind="not_found" />);
    expect(screen.getByTestId("prep-fallback-link")).toHaveAttribute(
      "href",
      "/progress",
    );
  });
});
