import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import type { InterviewPrepApplication } from "@/lib/interview-prep/types";
import {
  InterviewPrepPage,
  InterviewPrepUnavailable,
} from "./interview-prep-page";

vi.mock("@/components/ai-sidebar/ai-assist-context", () => ({
  useAiAssistOptional: () => ({
    openPanel: vi.fn().mockResolvedValue(true),
    openWithAssist: vi.fn(),
    invalidateAssistApply: vi.fn(),
    registerOpenHandler: () => () => {},
    registerPanelOpener: () => () => {},
    registerInvalidateHandler: () => () => {},
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
    scheduleHint: "面接日時がなくても準備できます。看板で日程を登録してください。",
    noInterviewStages: "面接段階がまだありません。",
    questionsComing: "想定質問は次の更新で追加されます。",
    questionsHeading: "想定質問（デモ）",
    questionsEmpty: "このラウンドの想定質問はまだありません。",
    demoNotice: "表示内容はデモ用の固定例です。",
    demoBadge: "デモ",
    intentLabel: "質問の意図",
    pointsLabel: "回答のポイント",
    expandDetails: "詳細を開く",
    collapseDetails: "詳細を閉じる",
    answerHeading: "自分の回答",
    openAiAssist: "AIで回答を作成・修正",
    aiAssistHint: "サイドバーを開きます",
    reflectComingSoon: "反映は今後",
    roundSwitchHint: "ラウンド切替で編集は失われます",
    editorHint: "デモ：入力内容は保存されません",
    editorPlaceholder: "ここに自分の回答を書いてください",
    aiUnavailable: "AI を開けませんでした",
    notFoundTitle: "応募が見つかりません",
    notFoundBody: "この応募は存在しないか、アクセスできません。",
    signedOutTitle: "ログインが必要です",
    signedOutBody: "面接準備を見るにはログインしてください。",
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

describe("InterviewPrepPage", () => {
  it("shows company, 面接未定, demo notice, and wider layout shell", () => {
    renderPrep(<InterviewPrepPage application={sample} />);

    const page = screen.getByTestId("interview-prep-page");
    expect(page).toBeInTheDocument();
    expect(page.className).toContain("max-w-5xl");
    expect(screen.getByTestId("prep-company")).toHaveTextContent(
      "株式会社サンプル",
    );
    expect(screen.getByTestId("prep-schedule-status")).toHaveTextContent(
      "面接未定",
    );
    expect(screen.getByTestId("prep-demo-notice")).toBeInTheDocument();
    expect(screen.getByTestId("prep-round-switch-hint")).toBeInTheDocument();
    expect(screen.getByTestId("prep-questions")).toBeInTheDocument();
    expect(screen.getByTestId("prep-question-common-motivation")).toBeInTheDocument();
  });

  it("expands details and does not expose mock generate entry", () => {
    renderPrep(<InterviewPrepPage application={sample} />);

    fireEvent.click(screen.getByTestId("prep-question-toggle-common-motivation"));
    expect(
      screen.getByTestId("prep-question-details-common-motivation"),
    ).toHaveTextContent("質問の意図");
    expect(
      screen.getByTestId("prep-ai-assist-common-motivation"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("prep-generate-common-motivation"),
    ).not.toBeInTheDocument();
  });

  it("keeps answer edits isolated per question and clears on round remount", () => {
    renderPrep(<InterviewPrepPage application={sample} />);

    fireEvent.click(screen.getByTestId("prep-question-toggle-common-motivation"));
    fireEvent.change(screen.getByTestId("prep-editor-input-common-motivation"), {
      target: { value: "動機ドラフト" },
    });
    expect(
      screen.getByTestId("prep-editor-input-common-motivation"),
    ).toHaveValue("動機ドラフト");

    fireEvent.click(screen.getByTestId("prep-question-toggle-common-self-pr"));
    expect(
      screen.getByTestId("prep-editor-input-common-self-pr"),
    ).toHaveValue("");

    fireEvent.change(screen.getByTestId("prep-round-select"), {
      target: { value: "st-final" },
    });
    expect(
      screen.queryByTestId("prep-editor-input-common-motivation"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("prep-question-final-offer")).toBeInTheDocument();
  });

  it("tracks which question last requested AI focus", async () => {
    renderPrep(<InterviewPrepPage application={sample} />);
    fireEvent.click(screen.getByTestId("prep-question-toggle-common-motivation"));
    fireEvent.click(screen.getByTestId("prep-ai-assist-common-motivation"));
    expect(screen.getByTestId("prep-questions")).toHaveAttribute(
      "data-ai-focused-question",
      "common-motivation",
    );
  });

  it("renders not-found shell", () => {
    renderPrep(<InterviewPrepUnavailable kind="not_found" />);
    expect(screen.getByTestId("interview-prep-not-found")).toBeInTheDocument();
    expect(screen.getByTestId("prep-fallback-link")).toHaveAttribute("href", "/");
  });
});
