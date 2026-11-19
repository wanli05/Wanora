import { describe, expect, it } from "vitest";
import { yearMonthFromInput } from "@/lib/domain/dates";
import {
  buildCareerTimeline,
  groupCareerTimelineByAt,
  timelineEventSummaryJa,
} from "./career-timeline";

describe("timelineEventSummaryJa", () => {
  it("maps event codes to Japanese business labels", () => {
    expect(timelineEventSummaryJa("joined")).toBe("入社");
    expect(timelineEventSummaryJa("left")).toBe("退社");
    expect(timelineEventSummaryJa("enrolled")).toBe("入学");
    expect(timelineEventSummaryJa("graduated")).toBe("卒業");
    expect(timelineEventSummaryJa("withdrawn")).toBe("中退");
    expect(timelineEventSummaryJa("completed")).toBe("修了");
    expect(timelineEventSummaryJa("transferred")).toBe("異動");
  });

  it("never returns raw English event codes for unknown values", () => {
    expect(timelineEventSummaryJa("unknown")).toBeUndefined();
    expect(timelineEventSummaryJa("Joined")).toBeUndefined();
  });
});

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

    const edu = items.find((i) => i.id === "edu-e1");
    const work = items.find((i) => i.id === "work-w1");
    expect(edu?.summary).toBe("卒業");
    expect(work?.summary).toBe("入社");
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
          endYm: yearMonthFromInput(2025, 3),
        },
      ],
      licenses: [],
      projects: [],
      skills: [],
      goals: [],
    });

    expect(items.some((i) => i.title.includes("新会社"))).toBe(true);
    expect(items.some((i) => i.title === "旧会社")).toBe(false);

    const join = items.find((i) => i.id === "emp-e1-join");
    const leave = items.find((i) => i.id === "emp-e1-leave");
    expect(join?.summary).toBe("入社");
    expect(leave?.summary).toBe("退社");
  });

  it("orders months by numeric year/month descending (9 before 10/12 as strings would be wrong)", () => {
    const items = buildCareerTimeline({
      education: [],
      workHistory: [],
      employers: [],
      licenses: [
        {
          id: "sep",
          acquiredYm: yearMonthFromInput(2025, 9),
          name: { ja: "九月" },
          createdAt: new Date("2025-01-01T00:00:00Z"),
        },
        {
          id: "dec",
          acquiredYm: yearMonthFromInput(2025, 12),
          name: { ja: "十二月" },
          createdAt: new Date("2025-01-02T00:00:00Z"),
        },
        {
          id: "oct",
          acquiredYm: yearMonthFromInput(2025, 10),
          name: { ja: "十月" },
          createdAt: new Date("2025-01-03T00:00:00Z"),
        },
      ],
      projects: [
        {
          id: "p-aug",
          startYm: yearMonthFromInput(2024, 8),
          title: { ja: "去年八月" },
          status: "confirmed",
          createdAt: new Date("2025-01-04T00:00:00Z"),
        },
      ],
      skills: [],
    });

    expect(items.map((i) => i.at)).toEqual([
      "2025年12月",
      "2025年10月",
      "2025年9月",
      "2024年8月",
    ]);

    const groups = groupCareerTimelineByAt(items);
    expect(groups.map((g) => g.at)).toEqual([
      "2025年12月",
      "2025年10月",
      "2025年9月",
      "2024年8月",
    ]);
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

  it("treats missing createdAt as entryOrder 0 within the same month", () => {
    const items = buildCareerTimeline({
      education: [],
      workHistory: [],
      employers: [],
      licenses: [
        {
          id: "no-created",
          acquiredYm: yearMonthFromInput(2025, 5),
          name: { ja: "無作成時刻" },
        },
        {
          id: "with-created",
          acquiredYm: yearMonthFromInput(2025, 5),
          name: { ja: "有作成時刻" },
          createdAt: new Date("2025-05-10T00:00:00Z"),
        },
      ],
      projects: [],
      skills: [],
    });

    expect(items.map((i) => i.id)).toEqual([
      "lic-no-created",
      "lic-with-created",
    ]);
  });

  it("is deterministic across rebuilds (post-refresh consistency)", () => {
    const input = {
      education: [
        {
          id: "e1",
          yearMonth: yearMonthFromInput(2023, 3),
          school: { ja: "A大学" },
          eventCode: "graduated",
          createdAt: new Date("2023-01-01T00:00:00Z"),
        },
      ],
      workHistory: [],
      employers: [
        {
          id: "emp1",
          companyName: { ja: "B社" },
          title: "Eng",
          startYm: yearMonthFromInput(2024, 9),
          endYm: yearMonthFromInput(2025, 10),
          createdAt: new Date("2024-01-01T00:00:00Z"),
        },
      ],
      licenses: [
        {
          id: "lic1",
          acquiredYm: yearMonthFromInput(2025, 12),
          name: { ja: "C資格" },
          createdAt: new Date("2025-01-01T00:00:00Z"),
        },
      ],
      projects: [],
      skills: [],
    };

    const first = buildCareerTimeline(input).map((i) => ({
      id: i.id,
      at: i.at,
      summary: i.summary,
    }));
    const second = buildCareerTimeline(input).map((i) => ({
      id: i.id,
      at: i.at,
      summary: i.summary,
    }));
    expect(second).toEqual(first);
    expect(first.map((i) => i.at)).toEqual([
      "2025年12月",
      "2025年10月",
      "2024年9月",
      "2023年3月",
    ]);
  });
});
