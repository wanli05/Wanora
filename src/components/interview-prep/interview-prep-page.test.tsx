import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import type { InterviewPrepApplication } from "@/lib/interview-prep/types";
import {
  InterviewPrepPage,
  InterviewPrepUnavailable,
} from "./interview-prep-page";

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
    demoNotice: "表示内容はデモ用の固定例です。求人や履歴に基づく個別分析ではありません。",
    demoBadge: "デモ",
    intentLabel: "質問の意図",
    pointsLabel: "回答のポイント",
    expandDetails: "詳細を開く",
    collapseDetails: "詳細を閉じる",
    generateSample: "AI回答例を生成",
    generatingSample: "生成中…",
    retrySample: "再試行",
    regenerateSample: "回答例を再生成",
    sampleHeading: "回答例（デモ）",
    generateError: "回答例を表示できませんでした。",
    editAnswer: "回答を編集",
    finishEdit: "編集を完了（デモ）",
    cancelEdit: "編集をやめる",
    draftHeading: "あなたの回答（デモ）",
    editorHint: "デモ：入力内容は保存されません",
    editorPlaceholder: "ここに自分の回答を書いてください",
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
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows company, 面接未定, demo notice, and mock questions", () => {
    renderPrep(<InterviewPrepPage application={sample} />);

    expect(screen.getByTestId("interview-prep-page")).toBeInTheDocument();
    expect(screen.getByTestId("prep-company")).toHaveTextContent(
      "株式会社サンプル",
    );
    expect(screen.getByTestId("prep-schedule-status")).toHaveTextContent(
      "面接未定",
    );
    expect(screen.getByTestId("prep-demo-notice")).toBeInTheDocument();
    expect(screen.getByTestId("prep-questions")).toBeInTheDocument();
    expect(screen.getByTestId("prep-question-common-motivation")).toBeInTheDocument();
    expect(screen.queryByTestId("prep-questions-placeholder")).not.toBeInTheDocument();
  });

  it("expands details and generates only the selected question sample", () => {
    renderPrep(<InterviewPrepPage application={sample} />);

    fireEvent.click(screen.getByTestId("prep-question-toggle-common-motivation"));
    expect(
      screen.getByTestId("prep-question-details-common-motivation"),
    ).toHaveTextContent("質問の意図");

    fireEvent.click(screen.getByTestId("prep-generate-common-motivation"));
    expect(
      screen.getByTestId("prep-question-common-motivation"),
    ).toHaveAttribute("data-answer-state", "loading");

    act(() => {
      vi.runAllTimers();
    });

    expect(
      screen.getByTestId("prep-sample-common-motivation"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("prep-sample-common-self-pr"),
    ).not.toBeInTheDocument();
  });

  it("switches mock pack when changing rounds", () => {
    renderPrep(<InterviewPrepPage application={sample} />);
    expect(screen.getByTestId("prep-questions")).toHaveAttribute(
      "data-stage-kind",
      "interview_1",
    );
    expect(screen.queryByTestId("prep-question-final-offer")).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId("prep-round-select"), {
      target: { value: "st-final" },
    });
    expect(screen.getByTestId("prep-questions")).toHaveAttribute(
      "data-stage-kind",
      "interview_final",
    );
    expect(screen.getByTestId("prep-question-final-offer")).toBeInTheDocument();
  });

  it("keeps drafts isolated per question and clears them when remounting on round change", () => {
    renderPrep(<InterviewPrepPage application={sample} />);

    fireEvent.click(screen.getByTestId("prep-generate-common-motivation"));
    act(() => {
      vi.runAllTimers();
    });
    fireEvent.click(screen.getByTestId("prep-edit-common-motivation"));
    fireEvent.change(screen.getByTestId("prep-editor-input-common-motivation"), {
      target: { value: "動機ドラフト" },
    });
    fireEvent.click(screen.getByTestId("prep-editor-finish-common-motivation"));
    expect(screen.getByTestId("prep-draft-common-motivation")).toHaveTextContent(
      "動機ドラフト",
    );

    fireEvent.click(screen.getByTestId("prep-generate-common-self-pr"));
    act(() => {
      vi.runAllTimers();
    });
    expect(screen.queryByTestId("prep-draft-common-self-pr")).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId("prep-round-select"), {
      target: { value: "st-final" },
    });
    expect(screen.queryByTestId("prep-draft-common-motivation")).not.toBeInTheDocument();
  });

  it("renders not-found shell", () => {
    renderPrep(<InterviewPrepUnavailable kind="not_found" />);
    expect(screen.getByTestId("interview-prep-not-found")).toBeInTheDocument();
    expect(screen.getByTestId("prep-fallback-link")).toHaveAttribute("href", "/");
  });
});
