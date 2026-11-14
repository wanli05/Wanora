import { describe, expect, it } from "vitest";
import { yearMonthFromInput } from "@/lib/domain/dates";
import { buildExportSnapshot } from "@/lib/domain/export-snapshot";
import { buildExportHtml } from "@/lib/export/build-export-html";

function sampleSnapshot() {
  return buildExportSnapshot({
    now: new Date("2026-11-13T03:00:00.000Z"),
    profile: {
      fullName: { ja: "楊　万里" },
      fullNameKana: "よう　わんり",
      birthDate: new Date(Date.UTC(1994, 4, 23)),
      gender: { ja: "男" },
      postalCode: "330-0072",
      address: { ja: "埼玉県さいたま市<script>" },
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
      nearestStation: "浦和駅",
      commuteHours: 1,
      commuteMinutes: 10,
      dependentsCount: 0,
      hasSpouse: false,
      spouseDependent: false,
    },
    education: [
      {
        yearMonth: yearMonthFromInput(2024, 4),
        school: { ja: "千葉科学大学" },
        eventCode: "graduated",
      },
    ],
    workHistory: [],
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
}

describe("buildExportHtml", () => {
  it("renders rirekisho with locked labels and escapes HTML", () => {
    const html = buildExportHtml(sampleSnapshot(), "rirekisho");
    expect(html).toContain("履　歴　書");
    expect(html).toContain("楊　万里");
    expect(html).not.toContain("現在の給与条件");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain('class="photo"');
    expect(html).toContain(">写真</div>");
    expect(html).toContain("最寄り");
    expect(html).toContain("浦和駅");
    expect(html).toContain("通勤時間");
    expect(html).toContain("約　1　時間　10　分");
    expect(html).toContain("扶養家族数（配偶者を除く）");
    expect(html).toContain("配偶者の扶養義務");
    expect(html).toContain("備考");
  });

  it("embeds 証明写真 JPEG in the rirekisho photo frame", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const html = buildExportHtml(sampleSnapshot(), "rirekisho", {
      photoPrintJpeg: jpeg,
    });
    expect(html).toContain('src="data:image/jpeg;base64,');
    expect(html).toContain('alt="証明写真"');
    expect(html).not.toContain(">写真</div>");
  });

  it("renders shokumu with project link and skills", () => {
    const html = buildExportHtml(sampleSnapshot(), "shokumu");
    expect(html).toContain("職　務　経　歴　書");
    expect(html).toContain("https://example.com");
    expect(html).toContain("TypeScript");
    expect(html).toContain("■自己PR");
  });
});
