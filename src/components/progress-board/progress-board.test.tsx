import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test-utils/intl";
import type { BoardPayload } from "@/lib/progress/dto";
import { ProgressBoard } from "./progress-board";

const empty: BoardPayload = {
  platforms: [],
  recruiters: [],
  applications: [],
  occupancy: [],
};

describe("ProgressBoard", () => {
  it("shows the empty state for a logged-in user with no applications", () => {
    renderWithIntl(<ProgressBoard initial={empty} />, "zh-CN");
    expect(screen.getByTestId("board-empty")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "投递进度" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "添加投递" }).length).toBeGreaterThan(0);
  });
});
