import { describe, expect, it } from "vitest";
import { yearMonthFromInput } from "@/lib/domain/dates";
import {
  buildExportSnapshot,
  resolveExportWorkHistory,
} from "./export-snapshot";

describe("buildExportSnapshot", () => {
  it("projects locked fields without JIS commute/family columns", () => {
    const snap = buildExportSnapshot({
      now: new Date("2026-11-13T03:00:00.000Z"),
      profile: {
        fullName: { ja: "楊　万里" },
        fullNameKana: "よう　わんり",
        birthDate: new Date(Date.UTC(1994, 4, 23)),
        gender: { ja: "男" },
        postalCode: "330-0072",
        address: { ja: "埼玉県さいたま市" },
        addressKana: "さいたまけん",
        phone: "080-0000-0000",
        email: "a@example.com",
        selfPr: { ja: "自己PR本文" },
        jobSummary: { ja: "職務要約" },
        strengths: ["要件定義"],
        languages: [{ language: "日本語", level: "ビジネス" }],
        residenceStatus: "技術・人文知識・国際業務",
        residencePeriod: "5年",
        residenceUntil: new Date(Date.UTC(2029, 2, 26)),
        salaryAnnualMan: 440,
        salaryBonusMan: 10,
        salaryMonthlyMan: 35,
        salaryOvertimeMan: 5,
        salaryHope: "460〜500万円",
        personalHope: { ja: "貴社規定に従います。" },
      },
      education: [
        {
          yearMonth: yearMonthFromInput(2024, 4),
          school: { ja: "千葉科学大学" },
          eventCode: "graduated",
        },
      ],
      workHistory: [
        {
          yearMonth: yearMonthFromInput(2020, 4),
          company: { ja: "旧データ会社" },
          eventCode: "joined",
        },
      ],
      licenses: [
        {
          acquiredYm: yearMonthFromInput(2021, 12),
          name: { ja: "日本語能力試験 N1 取得" },
        },
      ],
      employers: [
        {
          companyName: { ja: "株式会社ジンズ" },
          title: "PL",
          startYm: yearMonthFromInput(2024, 4),
          endYm: null,
          capitalText: "3,202百万円",
          revenueText: null,
          employeesText: null,
          narrative: null,
        },
      ],
      projects: [
        {
          title: { ja: "サンプルPJ" },
          titleUrl: "https://example.com",
          startYm: yearMonthFromInput(2025, 9),
          endYm: null,
          overview: { ja: "概要" },
          phases: { ja: "要件定義" },
          responsibilities: { ja: "推進" },
          results: { ja: "リリース" },
          environment: "React",
          roleText: "PL",
          scaleText: "1億円",
          teamSizeText: "10名",
          status: "confirmed",
        },
        {
          title: { ja: "草稿" },
          titleUrl: null,
          startYm: yearMonthFromInput(2025, 1),
          endYm: null,
          overview: null,
          phases: null,
          responsibilities: null,
          results: null,
          environment: null,
          roleText: null,
          scaleText: null,
          teamSizeText: null,
          status: "pending_confirm",
        },
      ],
      skills: [
        {
          category: "言語",
          name: "TypeScript",
          yearsText: "4年",
          description: "Web",
        },
      ],
    });

    expect(snap.asOfShokumu).toBe("2026年11月13日現在");
    expect(snap.asOfRirekisho).toContain("2026");
    expect(snap.residenceLines.join("\n")).toContain("在留資格");
    expect(snap.salaryLines[0]).toContain("440");
    expect(snap.projects).toHaveLength(1);
    expect(snap.projects[0].titleUrl).toBe("https://example.com");
    expect(snap.selfStudyLinks).toEqual([
      { label: "サンプルPJ", url: "https://example.com" },
    ]);
    // Prefer Work History employers over legacy resume-side rows.
    expect(snap.workLines).toEqual([
      { year: "2024", month: "4", text: "株式会社ジンズ　PL　入社" },
    ]);
    expect(JSON.stringify(snap)).not.toMatch(/通勤|扶養|配偶者|旧データ会社/);
  });
});

describe("resolveExportWorkHistory", () => {
  it("falls back to legacy work_history_entries when no employers", () => {
    const legacy = [
      {
        yearMonth: yearMonthFromInput(2023, 1),
        company: { ja: "レガシー社" },
        eventCode: "joined" as const,
      },
    ];
    expect(resolveExportWorkHistory([], legacy)).toEqual(legacy);
  });
});
