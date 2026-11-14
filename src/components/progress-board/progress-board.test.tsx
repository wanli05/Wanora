import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
    companyUrl: null,
    companyNotes: null,
    role: "エンジニア",
    platformId: "p-1",
    platformCode: "doda",
    platformName: null,
    recruiterId: null,
    recruiterName: null,
    appliedOn: "2026-11-06",
    jobPosting: {
      jobUrl: null,
      salaryBandText: null,
      benefitsText: null,
      jdText: null,
      processNotes: null,
      workLocationText: null,
      jobNotes: null,
    },
    hasJobPosting: false,
    hasFeedback: false,
    outcome: "in_progress",
    offerDecision: null,
    nextPrepNote: null,
    nextPrep: "書類の準備・提出",
    derivedNextPrep: "書類の準備・提出",
    currentStageId: "st-1",
    conflict: false,
    interview: null,
    stageInterviews: [],
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
    fireEvent.click(screen.getByTestId("card-menu-app-1"));
    expect(screen.getByRole("button", { name: "进入下一阶段" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "跳过" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "选考通过" })).not.toBeInTheDocument();
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

  it("spreads 書類選考→内定 columns equally across the board width", () => {
    renderWithIntl(
      <ProgressBoard
        initial={boardWith(sampleApp({ currentStageKind: "document_screening" }))}
      />,
      "zh-CN",
    );
    const row = screen.getByTestId("kanban-row");
    expect(row.className).toMatch(/\bw-full\b/);
    expect(row.className).not.toMatch(/overflow-x-auto/);

    const columns = [
      "document_screening",
      "aptitude_test",
      "interview_1",
      "interview_2",
      "interview_final",
      "offer",
    ].map((kind) => screen.getByTestId(`column-${kind}`));
    expect(columns).toHaveLength(6);
    for (const col of columns) {
      expect(col.className).toMatch(/\bflex-1\b/);
      expect(col.className).toMatch(/\bmin-w-0\b/);
      expect(col.className).not.toMatch(/\bw-36\b|\bw-56\b|\bshrink-0\b/);
    }
  });

  it("hides offer on document screening but keeps pass and reject", () => {
    renderWithIntl(
      <ProgressBoard
        initial={boardWith(sampleApp({ currentStageKind: "document_screening" }))}
      />,
      "zh-CN",
    );
    fireEvent.click(screen.getByTestId("card-menu-app-1"));
    expect(screen.getByRole("button", { name: "选考通过" })).toBeInTheDocument();
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
    fireEvent.click(screen.getByTestId("card-menu-app-1"));
    expect(screen.getByRole("button", { name: "选考通过" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "落选" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "内定" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "跳过" })).not.toBeInTheDocument();
  });

  it("asks before advancing when pass is chosen from the menu", () => {
    renderWithIntl(
      <ProgressBoard
        initial={boardWith(sampleApp({ currentStageKind: "document_screening" }))}
      />,
      "zh-CN",
    );
    fireEvent.click(screen.getByTestId("card-menu-app-1"));
    fireEvent.click(screen.getByTestId("action-pass"));
    expect(screen.getByTestId("pass-confirm-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("pass-confirm-yes")).toHaveTextContent("进入下一阶段");
  });

  it("exposes clickable task reminders on the board", () => {
    renderWithIntl(
      <ProgressBoard
        initial={boardWith(sampleApp({ currentStageKind: "document_screening" }))}
      />,
      "zh-CN",
    );
    expect(screen.getByTestId("task-bar")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("task-stat-waiting"));
    expect(screen.getByTestId("task-stat-waiting")).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  it("opens the calendar as an in-shell panel aligned with the board slot", () => {
    renderWithIntl(
      <ProgressBoard
        initial={boardWith(sampleApp({ currentStageKind: "document_screening" }))}
      />,
      "zh-CN",
    );
    const toggle = screen.getByTestId("calendar-toggle");
    expect(toggle).toHaveClass("pb-icon-cal");
    expect(toggle.querySelector(".pb-icon-cal-glyph")).not.toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByTestId("calendar-panel")).toBeInTheDocument();
    expect(screen.getByTestId("month-calendar")).toBeInTheDocument();
    expect(screen.queryByTestId("task-bar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("calendar-backdrop")).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute("data-active", "true");
  });

  it("places the calendar icon button left of add on the page toolbar", () => {
    renderWithIntl(
      <ProgressBoard
        initial={boardWith(sampleApp({ currentStageKind: "document_screening" }))}
      />,
      "zh-CN",
    );
    const toolbar = screen.getByTestId("page-toolbar");
    expect(toolbar.className).toMatch(/justify-between/);
    const actions = toolbar.querySelector(".pb-page-actions");
    expect(actions).not.toBeNull();
    expect(actions!.className).toMatch(/ml-auto/);
    const kids = Array.from(actions!.children);
    expect(kids[0]).toHaveAttribute("data-testid", "calendar-toggle");
    expect(kids[0]).toBeVisible();
    expect(kids[0]!.querySelector("svg")).not.toBeNull();
    expect(kids[1]).toHaveAttribute("data-testid", "add-application");
  });

  it("shows undo on rejected cards and after a pass", async () => {
    const { unmount } = renderWithIntl(
      <ProgressBoard
        initial={boardWith(
          sampleApp({
            currentStageKind: "interview_final",
            outcome: "rejected",
            stages: [
              {
                id: "st-final",
                kind: "interview_final",
                customLabel: null,
                position: 5,
                status: "failed",
                deadlineAt: null,
              },
            ],
          }),
        )}
      />,
      "zh-CN",
    );
      fireEvent.click(screen.getByRole("button", { name: "全部" }));
    fireEvent.click(screen.getByTestId("card-menu-app-1"));
    await waitFor(() => {
      expect(screen.getByTestId("action-undo")).toHaveTextContent("撤销");
    });
    unmount();

    renderWithIntl(
      <ProgressBoard
        initial={boardWith(
          sampleApp({
            currentStageKind: "aptitude_test",
            stages: [
              {
                id: "st-doc",
                kind: "document_screening",
                customLabel: null,
                position: 1,
                status: "passed",
                deadlineAt: null,
              },
              {
                id: "st-apt",
                kind: "aptitude_test",
                customLabel: null,
                position: 2,
                status: "pending",
                deadlineAt: null,
              },
            ],
          }),
        )}
      />,
      "zh-CN",
    );
    fireEvent.click(screen.getByTestId("card-menu-app-1"));
    expect(screen.getByTestId("action-undo")).toBeInTheDocument();
  });

  it("groups feedback by interview round in the edit drawer", async () => {
    renderWithIntl(
      <ProgressBoard
        initial={boardWith(
          sampleApp({
            currentStageKind: "interview_final",
            hasFeedback: true,
            stageInterviews: [
              {
                id: "iv-1",
                stageId: "st-1",
                stageKind: "interview_1",
                start: "2026-11-01T05:00:00.000Z",
                end: "2026-11-01T06:00:00.000Z",
                mode: "google_meet",
                meetingUrl: null,
                locationText: null,
                interviewers: "技術部門責任者",
                status: "scheduled",
                canWriteFeedback: true,
                feedbacks: [
                  {
                    id: "fb-1",
                    interviewId: "iv-1",
                    source: "company",
                    body: "志望動機が弱い",
                    question: null,
                    ownAnswer: null,
                    qaItems: [],
                    resultText: null,
                    reflection: null,
                    recordedOn: "2026-11-01",
                    summary: "会社 · 志望動機が弱い",
                  },
                  {
                    id: "fb-2",
                    interviewId: "iv-1",
                    source: "recruiter",
                    body: "次回は具体例を",
                    question: null,
                    ownAnswer: null,
                    qaItems: [],
                    resultText: null,
                    reflection: null,
                    recordedOn: "2026-11-02",
                    summary: "エージェント · 次回は具体例を",
                  },
                ],
              },
              {
                id: "iv-2",
                stageId: "st-2",
                stageKind: "interview_final",
                start: "2026-11-10T05:00:00.000Z",
                end: "2026-11-10T06:00:00.000Z",
                mode: "teams",
                meetingUrl: null,
                locationText: null,
                interviewers: null,
                status: "scheduled",
                canWriteFeedback: true,
                feedbacks: [],
              },
            ],
          }),
        )}
      />,
      "zh-CN",
    );
    fireEvent.click(screen.getByTestId("edit-app-1-detail"));
    await waitFor(() => {
      expect(screen.getByTestId("feedback-group-interview_1")).toBeInTheDocument();
    });
    expect(screen.getByTestId("feedback-group-interview_final")).toBeInTheDocument();
    expect(screen.getByText("会社 · 志望動機が弱い")).toBeInTheDocument();
    expect(screen.getByText("エージェント · 次回は具体例を")).toBeInTheDocument();
    expect(screen.getByTestId("append-feedback-iv-1")).toHaveTextContent("追加反馈");
    expect(screen.getByTestId("append-feedback-iv-2")).toHaveTextContent("记反馈");
    expect(screen.queryByText("评分（1–5）")).not.toBeInTheDocument();
  });

  it("labels withdraw as 辞退", () => {
    renderWithIntl(
      <ProgressBoard
        initial={boardWith(sampleApp({ currentStageKind: "document_screening" }))}
      />,
      "ja",
    );
    fireEvent.click(screen.getByTestId("card-menu-app-1"));
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
    fireEvent.click(screen.getByTestId("edit-app-1-detail"));
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "编辑投递" })).toBeInTheDocument();
    });
    expect(screen.getByTestId("edit-section-tabs")).toBeInTheDocument();
    expect(screen.getByTestId("edit-tab-basic")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("basic-section")).not.toHaveAttribute("hidden");
    expect(screen.getByDisplayValue("テスト株式会社")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "エージェント担当者" })).toBeInTheDocument();
    expect(screen.getByLabelText("下一步行动")).toBeInTheDocument();
    // Mutual exclusive tabs: only 基本情報 visible on open.
    expect(screen.getByTestId("company-section")).toHaveAttribute("hidden");
    expect(screen.getByTestId("job-posting-section")).toHaveAttribute("hidden");
    expect(screen.getByTestId("stage-interviews-section")).toHaveAttribute(
      "hidden",
    );
    fireEvent.click(screen.getByTestId("edit-tab-job"));
    expect(screen.getByTestId("edit-tab-job")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("basic-section")).toHaveAttribute("hidden");
    expect(screen.getByTestId("job-posting-section")).not.toHaveAttribute(
      "hidden",
    );
    expect(screen.getByLabelText("求人其他")).toBeInTheDocument();
    expect(screen.queryByLabelText("备注")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存修改" })).toBeInTheDocument();
    expect(screen.getByTestId("delete-application")).toHaveTextContent("删除");
    expect(screen.getAllByRole("button", { name: "取消" }).length).toBeGreaterThan(0);
  });

  it("asks for confirmation before deleting an application", async () => {
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockReturnValue(false);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderWithIntl(
      <ProgressBoard
        initial={boardWith(sampleApp({ currentStageKind: "document_screening" }))}
      />,
      "zh-CN",
    );
    fireEvent.click(screen.getByTestId("edit-app-1-detail"));
    await waitFor(() => {
      expect(screen.getByTestId("delete-application")).toBeInTheDocument();
    });
    screen.getByTestId("delete-application").click();
    expect(confirmSpy).toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/board/applications/app-1"),
      expect.objectContaining({ method: "DELETE" }),
    );
    confirmSpy.mockRestore();
    fetchSpy.mockRestore();
  });

  it("shows job posting and feedback badges on the card", () => {
    renderWithIntl(
      <ProgressBoard
        initial={boardWith(
          sampleApp({
            currentStageKind: "document_screening",
            hasJobPosting: true,
            hasFeedback: true,
            jobPosting: {
              jobUrl: "https://example.com/job",
              salaryBandText: "500〜650万",
              benefitsText: null,
              jdText: null,
              processNotes: null,
              workLocationText: null,
              jobNotes: null,
            },
          }),
        )}
      />,
      "zh-CN",
    );
    expect(screen.getByTestId("badge-job-app-1")).toHaveTextContent("有求人");
    expect(screen.getByTestId("badge-feedback-app-1")).toHaveTextContent("有反馈");
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
    expect(screen.getByTestId("card-app-1")).toHaveTextContent("一次面试");
    expect(screen.getByTestId("card-app-1")).toHaveTextContent("Google Meet");
    expect(screen.getByTestId("card-app-1")).toHaveTextContent("参加");
    expect(screen.queryByTestId("action-interview")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("edit-app-1-detail"));
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
    fireEvent.click(screen.getByTestId("card-menu-app-1"));
    expect(screen.getByRole("button", { name: "候補日程を提出" })).toBeInTheDocument();
  });
});
