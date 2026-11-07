import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test-utils/intl";
import type { BoardApplication, BoardPayload } from "@/lib/progress/dto";
import { ProgressBoard } from "./progress-board";

const empty: BoardPayload = {
  platforms: [],
  recruiters: [],
  applications: [],
  occupancy: [],
};

const samplePlatforms: BoardPayload["platforms"] = [
  { id: "p-1", code: "doda", name: null },
  { id: "p-other", code: "other", name: null },
];

function sampleApp(
  overrides: Partial<BoardApplication> & Pick<BoardApplication, "currentStageKind">,
): BoardApplication {
  return {
    id: "app-1",
    company: "テスト株式会社",
    companyId: "co-1",
    role: "エンジニア",
    platformId: "p-1",
    platformCode: "doda",
    platformName: null,
    recruiterId: null,
    recruiterName: null,
    appliedOn: "2026-11-06",
    notes: null,
    outcome: "in_progress",
    offerDecision: null,
    nextPrepNote: null,
    nextPrep: "書類の準備・提出",
    derivedNextPrep: "書類の準備・提出",
    currentStageId: "st-1",
    conflict: false,
    interview: null,
    proposal: null,
    stages: [],
    ...overrides,
  };
}

function boardWith(app: BoardApplication): BoardPayload {
  return {
    platforms: samplePlatforms,
    recruiters: [],
    applications: [app],
    occupancy: [],
  };
}

describe("ProgressBoard", () => {
  it("shows the empty state for a logged-in user with no applications", () => {
    renderWithIntl(<ProgressBoard initial={empty} />, "zh-CN");
    expect(screen.getByTestId("board-empty")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "投递进度" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "添加投递" }).length).toBeGreaterThan(0);
  });

  it("hides pass/reject/offer/withdraw on the info session column", () => {
    renderWithIntl(
      <ProgressBoard
        initial={boardWith(sampleApp({ currentStageKind: "info_session" }))}
      />,
      "zh-CN",
    );
    expect(screen.getByRole("button", { name: "进入下一阶段" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "跳过" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "通过" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "落选" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "内定" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "辞退" })).not.toBeInTheDocument();
  });

  it("hides the info-session column until an in-progress card is in it", () => {
    const { unmount } = renderWithIntl(
      <ProgressBoard
        initial={boardWith(sampleApp({ currentStageKind: "document_screening" }))}
      />,
      "zh-CN",
    );
    expect(screen.queryByTestId("column-info_session")).not.toBeInTheDocument();
    expect(screen.getByTestId("column-document_screening")).toHaveAttribute(
      "data-occupied",
      "true",
    );
    expect(screen.getByTestId("column-aptitude_test")).toHaveAttribute(
      "data-occupied",
      "false",
    );
    unmount();

    renderWithIntl(
      <ProgressBoard
        initial={boardWith(sampleApp({ currentStageKind: "info_session" }))}
      />,
      "zh-CN",
    );
    expect(screen.getByTestId("column-info_session")).toHaveAttribute(
      "data-occupied",
      "true",
    );
  });

  it("hides offer on document screening but keeps pass and reject", () => {
    renderWithIntl(
      <ProgressBoard
        initial={boardWith(sampleApp({ currentStageKind: "document_screening" }))}
      />,
      "zh-CN",
    );
    expect(screen.getByRole("button", { name: "通过" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "落选" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "内定" })).not.toBeInTheDocument();
  });

  it("keeps pass/reject/offer on the final interview and hides skip", () => {
    renderWithIntl(
      <ProgressBoard
        initial={boardWith(sampleApp({ currentStageKind: "interview_final" }))}
      />,
      "zh-CN",
    );
    expect(screen.getByRole("button", { name: "通过" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "落选" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "内定" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "跳过" })).not.toBeInTheDocument();
  });

  it("labels withdraw as 辞退", () => {
    renderWithIntl(
      <ProgressBoard
        initial={boardWith(sampleApp({ currentStageKind: "document_screening" }))}
      />,
      "ja",
    );
    expect(screen.getByRole("button", { name: "辞退" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "応募辞退" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "スキップ" })).not.toBeInTheDocument();
  });

  it("opens the application for editing after create", async () => {
    renderWithIntl(
      <ProgressBoard
        initial={boardWith(sampleApp({ currentStageKind: "document_screening" }))}
      />,
      "zh-CN",
    );
    expect(screen.getByTestId("card-app-1")).toHaveTextContent("Doda");
    screen.getByRole("button", { name: "编辑" }).click();
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "编辑投递" })).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("テスト株式会社")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "エージェント担当者" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存修改" })).toBeInTheDocument();
  });

  it("hides interview end time and shows custom platform when その他 is selected", async () => {
    renderWithIntl(
      <ProgressBoard
        initial={boardWith(
          sampleApp({
            currentStageKind: "interview_1",
            interview: {
              id: "iv-1",
              start: "2026-11-12T05:00:00.000Z",
              end: "2026-11-12T06:00:00.000Z",
              mode: "google_meet",
              meetingUrl: "https://meet.example/abc",
              locationText: null,
              status: "scheduled",
            },
            nextPrep: "一次面接",
            derivedNextPrep: "一次面接",
          }),
        )}
      />,
      "zh-CN",
    );
    expect(screen.getByTestId("card-app-1")).toHaveTextContent("一次面接");
    expect(screen.getByTestId("card-app-1")).toHaveTextContent("Google Meet");
    expect(screen.getByTestId("card-app-1")).toHaveTextContent("参加");
    expect(screen.queryByTestId("action-interview")).not.toBeInTheDocument();

    screen.getByRole("button", { name: "编辑" }).click();
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "编辑投递" })).toBeInTheDocument();
    });
    expect(screen.queryByLabelText("结束（东京）")).not.toBeInTheDocument();
    expect(screen.getByLabelText("开始（东京）")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog", { name: "编辑投递" });
    fireEvent.change(dialog.querySelector('select[name="platformId"]')!, {
      target: { value: "p-other" },
    });
    expect(screen.getByLabelText("自定义平台名")).toBeInTheDocument();
  });

  it("shows 面接未確定 and no 確定した面接 button when interview is unset", () => {
    renderWithIntl(
      <ProgressBoard
        initial={boardWith(
          sampleApp({
            currentStageKind: "interview_1",
            nextPrep: "一次面接",
            derivedNextPrep: "一次面接",
          }),
        )}
      />,
      "ja",
    );
    const card = screen.getByTestId("card-app-1");
    expect(card).toHaveTextContent("一次面接");
    expect(card).toHaveTextContent("面接未確定");
    expect(card).not.toHaveTextContent("の準備");
    expect(screen.queryByRole("button", { name: "確定した面接" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("action-interview")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "候補日程を提出" })).toBeInTheDocument();
  });
});
