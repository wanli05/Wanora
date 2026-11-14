import { describe, expect, it } from "vitest";
import { yearMonthFromInput } from "@/lib/domain/dates";
import { buildCareerTimeline, groupCareerTimelineByAt } from "./career-timeline";

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
        { id: "g2", kind: "long", content: { ja: "長期目標" } },
      ],
    });

    expect(items.some((i) => i.title === "確定")).toBe(true);
    expect(items.some((i) => i.title === "草稿")).toBe(false);
    // Undated goals stay in Career Goals, not the timeline.
    expect(items.some((i) => i.module === "goals")).toBe(false);
    expect(items.some((i) => i.title === "長期目標")).toBe(false);
  });

  it("prefers employers over legacy work history rows", () => {
    const items = buildCareerTimeline({
      education: [],
      workHistory: [
        {
          id: "legacy",
          yearMonth: yearMonthFromInput(2020, 1),
          company: { ja: "旧会社" },
          eventCode: "joined",
        },
      ],
      employers: [
        {
          id: "e1",
          companyName: { ja: "新会社" },
          title: "PM",
          startYm: yearMonthFromInput(2024, 4),
          endYm: null,
        },
      ],
      licenses: [],
      projects: [],
      skills: [],
      goals: [],
    });

    expect(items.some((i) => i.title.includes("新会社"))).toBe(true);
    expect(items.some((i) => i.title === "旧会社")).toBe(false);
  });

  it("orders same-month events left-to-right by entry time", () => {
    const items = buildCareerTimeline({
      education: [
        {
          id: "e1",
          yearMonth: yearMonthFromInput(2024, 4),
          school: { ja: "後录入学歴" },
          eventCode: "graduated",
          createdAt: new Date("2024-06-02T00:00:00Z"),
        },
      ],
      workHistory: [],
      employers: [
        {
          id: "emp1",
          companyName: { ja: "先录入会社" },
          title: null,
          startYm: yearMonthFromInput(2024, 4),
          endYm: null,
          createdAt: new Date("2024-06-01T00:00:00Z"),
        },
      ],
      licenses: [
        {
          id: "l1",
          acquiredYm: yearMonthFromInput(2024, 4),
          name: { ja: "中录入資格" },
          createdAt: new Date("2024-06-01T12:00:00Z"),
        },
      ],
      projects: [],
      skills: [],
    });

    const april = items.filter((i) => i.at.includes("2024"));
    expect(april.map((i) => i.title)).toEqual([
      "先录入会社",
      "中录入資格",
      "後录入学歴",
    ]);

    const groups = groupCareerTimelineByAt(items);
    const aprilGroup = groups.find((g) => g.at.includes("2024"));
    expect(aprilGroup?.items).toHaveLength(3);
  });
});
