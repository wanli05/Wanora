import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test-utils/intl";
import { ProgressBoard } from "./progress-board";

describe("ProgressBoard", () => {
  it("renders kanban columns and Japanese company cards", () => {
    renderWithIntl(<ProgressBoard />, "zh-CN");
    expect(screen.getByRole("heading", { name: "投递进度" })).toBeInTheDocument();
    expect(screen.getByTestId("column-interview_1")).toBeInTheDocument();
    expect(screen.getByText("株式会社メルカリ")).toBeInTheDocument();
    expect(screen.getByTestId("card-mercari")).toHaveTextContent("えん転職");
    const join = screen.getAllByRole("link", { name: "参加" });
    expect(
      join.some((link) => link.getAttribute("href")?.includes("meet.google.com")),
    ).toBe(true);
    expect(screen.getAllByText("时间冲突").length).toBeGreaterThan(0);
  });

  it("switches to list view", () => {
    renderWithIntl(<ProgressBoard />, "zh-CN");
    fireEvent.click(screen.getByRole("button", { name: "列表" }));
    expect(screen.getByTestId("row-mercari")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "猎头" })).toBeInTheDocument();
  });

  it("can show the empty state", () => {
    renderWithIntl(<ProgressBoard />, "zh-CN");
    fireEvent.click(screen.getByRole("button", { name: "显示空状态" }));
    expect(screen.getByTestId("board-empty")).toHaveTextContent("还没有投递");
  });

  it("opens the in-place month calendar with confirmed and proposed times", () => {
    renderWithIntl(<ProgressBoard />, "zh-CN");
    fireEvent.click(screen.getByTestId("calendar-toggle"));
    expect(screen.getByTestId("month-calendar")).toBeInTheDocument();
    expect(screen.getByTestId("cal-day-2026-11-12")).toHaveTextContent("メルカリ");
    expect(screen.getByTestId("cal-day-2026-11-14")).toHaveTextContent("パナソニック");
  });

  it("opens a week grid with occupied cells painted and blocks overlap", () => {
    renderWithIntl(<ProgressBoard />, "zh-CN");
    fireEvent.click(
      within(screen.getByTestId("card-nttdata")).getByRole("button", {
        name: "候选时段",
      }),
    );
    expect(screen.getByTestId("slot-grid")).toBeInTheDocument();
    expect(screen.getByTestId("slot-cell-2026-11-12-14")).toHaveAttribute(
      "data-occupancy",
      "confirmed",
    );
    expect(screen.getByTestId("slot-cell-2026-11-14-10")).toHaveAttribute(
      "data-occupancy",
      "proposed",
    );
    fireEvent.pointerDown(screen.getByTestId("slot-cell-2026-11-14-10"));
    expect(screen.getByRole("alert")).toHaveTextContent("已经答应过另一家公司");
  });
});
