import { screen, waitFor } from "@testing-library/react";
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
    platforms: [{ id: "p-1", code: "doda", name: null }],
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
    expect(screen.getByRole("button", { name: "跳过" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "通过" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "落选" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "内定" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "辞退応募" })).not.toBeInTheDocument();
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

  it("hides pass on the final interview and keeps reject and offer", () => {
    renderWithIntl(
      <ProgressBoard
        initial={boardWith(sampleApp({ currentStageKind: "interview_final" }))}
      />,
      "zh-CN",
    );
    expect(screen.queryByRole("button", { name: "通过" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "落选" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "内定" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "跳过" })).toBeInTheDocument();
  });

  it("opens the application for editing after create", async () => {
    renderWithIntl(
      <ProgressBoard
        initial={boardWith(sampleApp({ currentStageKind: "document_screening" }))}
      />,
      "zh-CN",
    );
    screen.getByRole("button", { name: "编辑投递" }).click();
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "编辑投递" })).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("テスト株式会社")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存修改" })).toBeInTheDocument();
  });
});
