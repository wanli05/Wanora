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
    // WN-58: commute/family sit beside 備考 (not in address block).
    const licensesIdx = html.indexOf("免許・資格");
    const bikoIdx = html.indexOf("備考：");
    const nearestIdx = html.indexOf("最寄り");
    const commuteIdx = html.indexOf("通勤時間");
    expect(licensesIdx).toBeGreaterThan(-1);
    expect(bikoIdx).toBeGreaterThan(licensesIdx);
    expect(nearestIdx).toBeGreaterThan(bikoIdx);
    expect(commuteIdx).toBeGreaterThan(nearestIdx);
    expect(html).toContain('class="biko-wrap"');
    expect(html).toContain('rowspan="4"');
    expect(html).toContain('class="rk-top"');
    expect(html).toContain('class="rk-title"');
    expect(html).toContain('class="rk-addr"');
    // 最寄り must not appear in the address block (before 学歴・職歴).
    const addressBlock = html.slice(0, html.indexOf("学歴・職歴"));
    expect(addressBlock).not.toContain("最寄り");
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

  it("merges 分類 cells for multi-skill categories in shokumu skills table", () => {
    const base = sampleSnapshot();
    const html = buildExportHtml(
      {
        ...base,
        skillRows: [
          {
            category: "OS",
            name: "Linux",
            yearsText: "3年",
            description: "サーバ",
          },
          {
            category: "言語",
            name: "TypeScript",
            yearsText: "4年",
            description: "Web",
          },
          {
            category: "OS",
            name: "Windows",
            yearsText: "2年",
            description: "開発",
          },
          {
            category: "言語",
            name: "JavaScript",
            yearsText: "5年",
            description: "FE",
          },
          {
            category: "FW",
            name: "React",
            yearsText: "3年",
            description: "UI",
          },
          {
            category: "言語",
            name: "Python",
            yearsText: "1年",
            description: "脚本",
          },
        ],
      },
      "shokumu",
    );
    const skillsIdx = html.indexOf("■（テクニカル）スキル");
    const skillsHtml = html.slice(skillsIdx);
    expect(skillsHtml).toContain('rowspan="2"');
    expect(skillsHtml).toContain('rowspan="3"');
    expect(skillsHtml).toMatch(
      /rowspan="2"[^>]*>OS[\s\S]*Windows[\s\S]*rowspan="3"[^>]*>言語[\s\S]*>FW</,
    );
    // Single-skill category: ordinary cell, no rowspan on FW
    expect(skillsHtml).toMatch(/<td style="vertical-align:top;text-align:left">FW<\/td>/);
  });
});
