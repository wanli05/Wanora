import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
    demoNotice: "表示内容はデモ用です。JD・履歴に基づく個別分析ではありません。",
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
  it("shows company, role, 面接未定, and round selector without inventing interviews", () => {
    renderPrep(<InterviewPrepPage application={sample} />);

    expect(screen.getByTestId("interview-prep-page")).toBeInTheDocument();
    expect(screen.getByTestId("prep-company")).toHaveTextContent(
      "株式会社サンプル",
    );
    expect(screen.getByTestId("prep-role")).toHaveTextContent(
      "プロダクトエンジニア",
    );
    expect(screen.getByTestId("prep-schedule-status")).toHaveTextContent(
      "面接未定",
    );
    expect(screen.getByTestId("prep-questions-placeholder")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "応募進捗に戻る" })).toHaveAttribute(
      "href",
      "/",
    );

    const select = screen.getByTestId("prep-round-select");
    fireEvent.change(select, { target: { value: "st-final" } });
    expect(select).toHaveValue("st-final");
  });

  it("renders not-found shell", () => {
    renderPrep(<InterviewPrepUnavailable kind="not_found" />);
    expect(screen.getByTestId("interview-prep-not-found")).toBeInTheDocument();
    expect(screen.getByTestId("prep-fallback-link")).toHaveAttribute("href", "/");
  });
});
