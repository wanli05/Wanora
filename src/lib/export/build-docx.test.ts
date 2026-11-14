import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { yearMonthFromInput } from "@/lib/domain/dates";
import { buildExportSnapshot } from "@/lib/domain/export-snapshot";
import { buildExportDocx } from "@/lib/export/build-docx";

/** Extract word/document.xml from a DOCX (ZIP) without extra deps. */
function documentXmlFromDocx(buf: Buffer): string {
  const name = "word/document.xml";
  let offset = 0;
  while (offset + 30 < buf.length) {
    if (buf.readUInt32LE(offset) !== 0x04034b50) break;
    const method = buf.readUInt16LE(offset + 8);
    const compSize = buf.readUInt32LE(offset + 18);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const entryName = buf
      .subarray(offset + 30, offset + 30 + nameLen)
      .toString("utf8");
    const dataStart = offset + 30 + nameLen + extraLen;
    const data = buf.subarray(dataStart, dataStart + compSize);
    if (entryName === name) {
      const raw = method === 0 ? data : inflateRawSync(data);
      return raw.toString("utf8");
    }
    offset = dataStart + compSize;
  }
  throw new Error("word/document.xml not found in docx");
}

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

  it("keeps rirekisho title left and photo beside identity (not below)", async () => {
    const xml = documentXmlFromDocx(
      await buildExportDocx(sampleSnapshot(), "rirekisho"),
    );
    // Title paragraph is left-aligned (not center).
    expect(xml).toMatch(/<w:jc w:val="left"\/>[\s\S]{0,200}履　歴　書/);
    expect(xml).toMatch(
      /履　歴　書[\s\S]{0,400}<w:jc w:val="right"\/>[\s\S]{0,200}日現在/,
    );
    // Outer header tblGrid is 2 columns: identity stack | photo.
    expect(xml).toMatch(
      /<w:tblGrid><w:gridCol[^/]*\/>\s*<w:gridCol[^/]*\/><\/w:tblGrid><w:tr>[\s\S]*?ふりがな[\s\S]*?写真/,
    );
    // Photo cell must not use vMerge (rowspan) — that dropped it bottom-left in Word.
    const photoIdx = xml.indexOf(">写真<");
    expect(photoIdx).toBeGreaterThan(-1);
    const photoCellStart = xml.lastIndexOf("<w:tc>", photoIdx);
    const photoCell = xml.slice(photoCellStart, photoIdx);
    expect(photoCell).not.toContain("w:vMerge");
  });

  it("forces shokumu section titles black without Word Heading styles", async () => {
    const xml = documentXmlFromDocx(
      await buildExportDocx(sampleSnapshot(), "shokumu"),
    );
    expect(xml).toContain("■職務経歴");
    expect(xml).not.toMatch(/w:pStyle[^>]*Heading/i);
    expect(xml).not.toMatch(/w:outlineLvl/);
    // Section label run must pin theme-independent black.
    expect(xml).toMatch(
      /<w:color w:val="000000"\/>[\s\S]{0,120}■職務経歴/,
    );
    expect(xml).toMatch(/<w:color w:val="000000"\/>[\s\S]{0,80}職　務　経　歴　書/);
  });
});
