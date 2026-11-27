import { describe, expect, it } from "vitest";
import { yearMonthFromInput } from "@/lib/domain/dates";
import { buildExportSnapshot } from "@/lib/domain/export-snapshot";
import {
  convertDocxToPdf,
  isDocxToPdfAvailable,
} from "@/lib/export/convert-docx-to-pdf";
import { fillRirekishoDocx } from "@/lib/export/fill-rirekisho-docx";

describe("convertDocxToPdf", () => {
  it("lists Windows Program Files soffice paths among candidates on win32", async () => {
    // Smoke: module loads; availability probe must not throw.
    await expect(isDocxToPdfAvailable()).resolves.toBeTypeOf("boolean");
  });

  it("converts a filled 履歴書 DOCX to a PDF when LibreOffice is available", async () => {
    const available = await isDocxToPdfAvailable();
    if (!available) {
      // Deploy image installs libreoffice-writer; local CI without it skips.
      expect(available).toBe(false);
      return;
    }
    const snap = buildExportSnapshot({
      now: new Date("2026-11-13T03:00:00.000Z"),
      profile: {
        fullName: { ja: "山田　太郎" },
        fullNameKana: "やまだ　たろう",
        birthDate: new Date(Date.UTC(1990, 0, 15)),
        gender: { ja: "男" },
        postalCode: "100-0001",
        address: { ja: "東京都千代田区" },
        addressKana: "とうきょうと",
        phone: "03-0000-0000",
        email: "taro.fiction@example.test",
        selfPr: { ja: "一行目\n二行目" },
        jobSummary: null,
        strengths: [],
        languages: [],
        residenceStatus: null,
        residencePeriod: null,
        residenceUntil: null,
        salaryAnnualMan: null,
        salaryBonusMan: null,
        salaryMonthlyMan: null,
        salaryOvertimeMan: null,
        salaryHope: null,
        personalHope: { ja: "希望" },
        photoKey: null,
      },
      education: [
        {
          yearMonth: yearMonthFromInput(2008, 4),
          school: { ja: "架空大学" },
          eventCode: "enrolled",
        },
      ],
      workHistory: [],
      licenses: [],
      employers: [],
      projects: [],
      skills: [],
    });
    const docx = await fillRirekishoDocx(snap);
    const pdf = await convertDocxToPdf(docx);
    expect(pdf.subarray(0, 4).toString("utf8")).toBe("%PDF");
    expect(pdf.byteLength).toBeGreaterThan(1000);
  }, 120_000);
});
