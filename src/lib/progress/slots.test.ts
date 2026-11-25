import { describe, expect, it } from "vitest";
import {
  applyDragRange,
  cellRange,
  rangeFromCellIndices,
  slotStarts,
  toggleCellInDrafts,
} from "./slots";

describe("slots variable duration", () => {
  const starts = slotStarts();
  const appId = "app-1";

  it("builds a 90-minute range from three 30-min cells", () => {
    const day = "2026-11-24";
    const from = starts.findIndex((c) => c.label === "10:00");
    const to = starts.findIndex((c) => c.label === "11:00");
    const range = rangeFromCellIndices(day, starts, from, to);
    expect(range?.start).toContain("T10:00:00+09:00");
    expect(new Date(range!.end).getTime() - new Date(range!.start).getTime()).toBe(
      90 * 60 * 1000,
    );
  });

  it("keeps adjacent independent slots separate", () => {
    const a = cellRange("2026-11-24", 10, 0);
    const b = cellRange("2026-11-24", 10, 30);
    const drafts = [a];
    const added = applyDragRange(drafts, b, [], appId, true);
    expect(added.drafts).toHaveLength(2);
    expect(added.drafts).toEqual([a, b]);
  });

  it("splits a continuous block when the middle cell is toggled off", () => {
    const day = "2026-11-24";
    const from = starts.findIndex((c) => c.label === "10:00");
    const to = starts.findIndex((c) => c.label === "11:00");
    const range = rangeFromCellIndices(day, starts, from, to)!;
    const middle = cellRange(day, 10, 30);
    const result = toggleCellInDrafts([range], middle, [], appId);
    expect(result.drafts).toHaveLength(2);
    expect(result.drafts[0]).toEqual(cellRange(day, 10, 0));
    expect(result.drafts[1]).toEqual(cellRange(day, 11, 0));
  });
});
