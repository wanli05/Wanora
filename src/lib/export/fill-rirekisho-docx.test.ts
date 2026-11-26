import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { yearMonthFromInput } from "@/lib/domain/dates";
import { buildExportSnapshot } from "@/lib/domain/export-snapshot";
import {
  RIREKISHO_FIELDS_NOT_ON_TEMPLATE,
  buildRirekishoHistoryLines,
  docxHasEntry,
  fillRirekishoDocx,
  readDocxEntry,
  roundTripRirekishoTemplate,
} from "@/lib/export/fill-rirekisho-docx";
import {
  RIREKISHO_GRIDS,
  RIREKISHO_PAGE,
  RIREKISHO_PHOTO_EMU,
  RIREKISHO_RECORD_ROW_HEIGHT_TWIPS,
  RIREKISHO_TEMPLATE_SHA256,
  loadRirekishoTemplateBytes,
} from "@/lib/export/rirekisho-template";

const MIN_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

function fictionSnapshot(opts?: {
  edu?: number;
  work?: number;
  licenses?: number;
  longPr?: boolean;
}) {
  const edu = opts?.edu ?? 2;
  const work = opts?.work ?? 2;
  const licenses = opts?.licenses ?? 2;
  return buildExportSnapshot({
    now: new Date("2026-11-13T03:00:00.000Z"),
    profile: {
      fullName: { ja: "山田　太郎" },
      fullNameKana: "やまだ　たろう",
      birthDate: new Date(Date.UTC(1990, 0, 15)),
      gender: { ja: "男" },
      postalCode: "100-0001",
      address: { ja: "東京都千代田区千代田１−１　架空マンション１０１" },
      addressKana: "とうきょうとちよだくちよだ",
      phone: "03-0000-0000",
      email: "taro.fiction@example.test",
      selfPr: {
        ja: opts?.longPr
          ? "自己PR。".repeat(80)
          : "要件定義と関係者調整を強みとする架空の自己PRです。",
      },
      jobSummary: { ja: "職務要約は履歴書テンプレ欄外" },
      strengths: ["要件定義"],
      languages: [{ language: "日本語", level: "ネイティブ" }],
      residenceStatus: "技術・人文知識・国際業務",
      residencePeriod: "5年",
      residenceUntil: new Date(Date.UTC(2029, 2, 26)),
      salaryAnnualMan: 500,
      salaryBonusMan: 50,
      salaryMonthlyMan: 35,
      salaryOvertimeMan: null,
      salaryHope: "550",
      personalHope: { ja: "勤務地は首都圏を希望します（架空）。" },
      nearestStation: "架空駅",
      commuteHours: 1,
      commuteMinutes: 20,
      dependentsCount: 0,
      hasSpouse: false,
      spouseDependent: false,
      photoKey: "fiction/photo",
    },
    education: Array.from({ length: edu }, (_, i) => ({
      yearMonth: yearMonthFromInput(2008 + i, 4),
      school: { ja: `架空大学${i + 1}` },
      eventCode: i % 2 === 0 ? ("enrolled" as const) : ("graduated" as const),
    })),
    workHistory: [],
    licenses: Array.from({ length: licenses }, (_, i) => ({
      acquiredYm: yearMonthFromInput(2015 + i, 6),
      name: { ja: `架空資格${i + 1}` },
    })),
    employers: Array.from({ length: Math.ceil(work / 2) }, (_, i) => ({
      companyName: { ja: `架空株式会社${i + 1}` },
      title: "エンジニア",
      startYm: yearMonthFromInput(2016 + i * 3, 4),
      endYm:
        i === Math.ceil(work / 2) - 1
          ? null
          : yearMonthFromInput(2018 + i * 3, 3),
      capitalText: null,
      revenueText: null,
      employeesText: null,
      narrative: null,
    })),
    projects: [],
    skills: [],
  });
}

function gridCols(xml: string, tableIndex: number): number[] {
  const grids = [...xml.matchAll(/<w:tblGrid>([\s\S]*?)<\/w:tblGrid>/g)];
  const g = grids[tableIndex]?.[1] ?? "";
  return [...g.matchAll(/w:w="(\d+)"/g)].map((m) => Number(m[1]));
}

/** Join w:t runs — labels in the MHLW template are often split across runs. */
function joinedText(xml: string): string {
  return [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1] ?? "")
    .join("");
}

describe("rirekisho template asset", () => {
  it("matches the locked SHA-256 baseline", () => {
    const buf = loadRirekishoTemplateBytes();
    expect(createHash("sha256").update(buf).digest("hex")).toBe(
      RIREKISHO_TEMPLATE_SHA256,
    );
  });
});

describe("roundTripRirekishoTemplate", () => {
  it("preserves layout attributes after ZIP round-trip (no content edit)", async () => {
    const out = await roundTripRirekishoTemplate();
    const xml = await readDocxEntry(out, "word/document.xml");
    expect(xml).toContain(
      `w:w="${RIREKISHO_PAGE.widthTwips}" w:h="${RIREKISHO_PAGE.heightTwips}"`,
    );
    expect(xml).toMatch(
      new RegExp(
        `w:top="${RIREKISHO_PAGE.marginTwips}"[^>]*w:left="${RIREKISHO_PAGE.marginTwips}"`,
      ),
    );
    expect(gridCols(xml, 0)).toEqual([...RIREKISHO_GRIDS.identity]);
    expect(gridCols(xml, 1)).toEqual([...RIREKISHO_GRIDS.historyPage1]);
    expect(gridCols(xml, 2)).toEqual([...RIREKISHO_GRIDS.historyPage2]);
    expect(xml).toContain(
      `w:hRule="exact" w:val="${RIREKISHO_RECORD_ROW_HEIGHT_TWIPS}"`,
    );
    expect(xml).toContain(
      `cx="${RIREKISHO_PHOTO_EMU.cx}" cy="${RIREKISHO_PHOTO_EMU.cy}"`,
    );
    // Blank template keeps photo placeholder copy.
    expect(joinedText(xml)).toContain("写真を");
    expect(joinedText(xml)).toContain("貼る");
    expect(await docxHasEntry(out, "word/media/wanora_photo.jpeg")).toBe(false);
  });
});

describe("fillRirekishoDocx", () => {
  it("fills identity / hope / selfPr without inventing 志望動機", async () => {
    const snap = fictionSnapshot();
    const buf = await fillRirekishoDocx(snap);
    const xml = await readDocxEntry(buf, "word/document.xml");
    const text = joinedText(xml);
    expect(text).toContain("山田　太郎");
    expect(text).toContain("やまだ　たろう");
    expect(text).toContain("2026　年　11月　13日現在");
    expect(text).toContain("〒100-0001");
    expect(text).toContain("東京都千代田区千代田１−１");
    expect(text).toContain("03-0000-0000");
    expect(text).toContain("taro.fiction@example.test");
    expect(text).toContain("要件定義と関係者調整を強みとする架空の自己PRです。");
    expect(text).toContain("勤務地は首都圏を希望します（架空）。");
    expect(text).not.toContain("志望動機を生成");
    // 連絡先 note preserved; address not duplicated into 連絡先 value area.
    expect(text).toContain("現住所以外に連絡を希望する場合のみ記入");
    // Layout guards still hold.
    expect(gridCols(xml, 0)).toEqual([...RIREKISHO_GRIDS.identity]);
    expect(gridCols(xml, 1)).toEqual([...RIREKISHO_GRIDS.historyPage1]);
  });

  it("keeps blank photo placeholder when no JPEG is provided", async () => {
    const buf = await fillRirekishoDocx(fictionSnapshot());
    const xml = await readDocxEntry(buf, "word/document.xml");
    expect(joinedText(xml)).toContain("写真を");
    expect(await docxHasEntry(buf, "word/media/wanora_photo.jpeg")).toBe(false);
  });

  it("embeds JPEG into the existing floating frame slot", async () => {
    const buf = await fillRirekishoDocx(fictionSnapshot(), MIN_JPEG);
    expect(await docxHasEntry(buf, "word/media/wanora_photo.jpeg")).toBe(true);
    const xml = await readDocxEntry(buf, "word/document.xml");
    expect(xml).toContain(`r:embed="rIdPhotoWanora"`);
    expect(xml).toContain(
      `cx="${RIREKISHO_PHOTO_EMU.cx}" cy="${RIREKISHO_PHOTO_EMU.cy}"`,
    );
    expect(joinedText(xml)).not.toContain("写真を");
    const rels = await readDocxEntry(buf, "word/_rels/document.xml.rels");
    expect(rels).toContain("media/wanora_photo.jpeg");
  });

  it("preserves unused history rows for short resumes", async () => {
    const snap = fictionSnapshot({ edu: 1, work: 2, licenses: 1 });
    const lines = buildRirekishoHistoryLines(snap);
    expect(lines.some((l) => l.text === "学　歴")).toBe(true);
    expect(lines.some((l) => l.text === "職　歴")).toBe(true);
    expect(lines.some((l) => l.text === "以上")).toBe(true);
    expect(lines.length).toBeLessThan(15);
    const xml = await readDocxEntry(await fillRirekishoDocx(snap), "word/document.xml");
    // Still 15 exact-height data rows on page-1 history table (header + 15).
    const exact567 = [
      ...xml.matchAll(
        new RegExp(
          `w:hRule="exact" w:val="${RIREKISHO_RECORD_ROW_HEIGHT_TWIPS}"`,
          "g",
        ),
      ),
    ];
    expect(exact567.length).toBeGreaterThanOrEqual(15);
  });

  it("overflows history onto a continuation page instead of dropping rows", async () => {
    // 15 page1 + 7 page2 history slots; force more than 22 content lines.
    const snap = fictionSnapshot({ edu: 12, work: 20, licenses: 8 });
    const lines = buildRirekishoHistoryLines(snap);
    expect(lines.length).toBeGreaterThan(22);
    const xml = await readDocxEntry(
      await fillRirekishoDocx(snap),
      "word/document.xml",
    );
    expect(xml).toContain('w:type="page"');
    // All education/work company names present.
    expect(xml).toContain("架空大学1");
    expect(xml).toContain("架空株式会社1");
    expect(xml).toContain("架空資格8");
    // License header remains.
    expect(xml).toMatch(/免\s*許・資\s*格/);
  });

  it("documents profile fields that stay off the MHLW blank form", () => {
    expect(RIREKISHO_FIELDS_NOT_ON_TEMPLATE.length).toBeGreaterThan(3);
    expect(RIREKISHO_FIELDS_NOT_ON_TEMPLATE.join()).toContain("在留");
  });
});
