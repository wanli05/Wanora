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
      expect(buf.subarray(0, 2).toString("utf8")).toBe("PK");
    }
  });

  it("embeds a JPEG into rirekisho when photo bytes are provided", async () => {
    // Minimal valid-enough JPEG SOI/EOI; docx packs the bytes as-is.
    const jpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
    ]);
    const withPhoto = await buildExportDocx(sampleSnapshot(), "rirekisho", {
      photoPrintJpeg: jpeg,
    });
    const without = await buildExportDocx(sampleSnapshot(), "rirekisho");
    expect(withPhoto.byteLength).toBeGreaterThan(without.byteLength);
  });
});
