import { describe, expect, it } from "vitest";
import { yearMonthFromInput } from "@/lib/domain/dates";
import { buildExportSnapshot } from "@/lib/domain/export-snapshot";
import { buildExportDocx } from "@/lib/export/build-docx";

function sampleSnapshot() {
  return buildExportSnapshot({
    now: new Date("2026-11-13T03:00:00.000Z"),
    profile: {
      fullName: { ja: "楊　万里" },
      fullNameKana: "よう　わんり",
      birthDate: new Date(Date.UTC(1994, 4, 23)),
      gender: { ja: "男" },
      postalCode: null,
      address: { ja: "埼玉県" },
      addressKana: null,
      phone: "080-0000-0000",
      email: "a@example.com",
      selfPr: { ja: "PR" },
      jobSummary: { ja: "要約" },
      strengths: ["要件定義"],
      languages: [{ language: "日本語", level: "ビジネス" }],
      residenceStatus: null,
      residencePeriod: null,
      residenceUntil: null,
      salaryAnnualMan: 440,
      salaryBonusMan: null,
      salaryMonthlyMan: null,
      salaryOvertimeMan: null,
      salaryHope: null,
      personalHope: { ja: "希望なし" },
    },
    education: [],
    workHistory: [],
    licenses: [],
    employers: [
      {
        companyName: { ja: "株式会社ジンズ" },
        title: "PL",
        startYm: yearMonthFromInput(2024, 4),
        endYm: null,
        capitalText: null,
        revenueText: null,
        employeesText: null,
        narrative: null,
      },
    ],
    projects: [],
    skills: [],
  });
}

describe("buildExportDocx", () => {
  it("returns a ZIP/docx buffer for rirekisho and shokumu", async () => {
    const snap = sampleSnapshot();
    for (const doc of ["rirekisho", "shokumu"] as const) {
      const buf = await buildExportDocx(snap, doc);
      expect(buf.byteLength).toBeGreaterThan(1000);
      // DOCX is a ZIP package
      expect(buf.subarray(0, 2).toString("utf8")).toBe("PK");
    }
  });
});
