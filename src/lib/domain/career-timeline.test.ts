import { describe, expect, it } from "vitest";
import { yearMonthFromInput } from "@/lib/domain/dates";
import { buildCareerTimeline } from "./career-timeline";

describe("buildCareerTimeline", () => {
  it("aggregates modules and skips pending projects", () => {
    const items = buildCareerTimeline({
      education: [
        {
          id: "e1",
          yearMonth: yearMonthFromInput(2024, 4),
          school: { ja: "大学" },
          eventCode: "graduated",
        },
      ],
      workHistory: [
        {
          id: "w1",
          yearMonth: yearMonthFromInput(2024, 4),
          company: { ja: "会社" },
          eventCode: "joined",
        },
      ],
      licenses: [
        {
          id: "l1",
          acquiredYm: yearMonthFromInput(2021, 12),
          name: { ja: "N1" },
        },
      ],
      projects: [
        {
          id: "p1",
          startYm: yearMonthFromInput(2025, 9),
          title: { ja: "確定" },
          status: "confirmed",
        },
        {
          id: "p2",
          startYm: yearMonthFromInput(2025, 1),
          title: { ja: "草稿" },
          status: "pending_confirm",
        },
      ],
      skills: [],
      goals: [
        { id: "g1", kind: "short", content: { ja: "上流" } },
      ],
    });

    expect(items.some((i) => i.title === "確定")).toBe(true);
    expect(items.some((i) => i.title === "草稿")).toBe(false);
    expect(items.some((i) => i.module === "goals")).toBe(true);
  });
});
