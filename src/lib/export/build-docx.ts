import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type ITableCellOptions,
} from "docx";
import { planSkillTableRows } from "@/lib/domain/career-skills-table";
import type { ExportSnapshot } from "@/lib/domain/export-snapshot";
import type { ExportRenderOptions } from "@/lib/export/build-export-html";
import { fillRirekishoDocx } from "@/lib/export/fill-rirekisho-docx";
import type { ExportDocKind } from "@/lib/export/load-export-snapshot";

const BLACK = "000000";
const FONT = { eastAsia: "游明朝", ascii: "Times New Roman" } as const;

function run(
  text: string,
  opts?: { bold?: boolean; size?: number },
): TextRun {
  return new TextRun({
    text,
    bold: opts?.bold,
    size: opts?.size ?? 20,
    color: BLACK,
    font: FONT,
  });
}

const PAGE_WIDTH = 11906; // A4 twips
const MARGIN = 720; // ~0.5in
const CONTENT = PAGE_WIDTH - MARGIN * 2;

const thin = {
  style: BorderStyle.SINGLE,
  size: 8,
  color: BLACK,
};
const borders = { top: thin, bottom: thin, left: thin, right: thin };
function cell(
  text: string,
  opts: {
    width: number;
    bold?: boolean;
    center?: boolean;
    right?: boolean;
    shade?: string;
    colspan?: number;
    rowSpan?: number;
    size?: number;
    vAlign?:
      | typeof VerticalAlign.CENTER
      | typeof VerticalAlign.TOP
      | typeof VerticalAlign.BOTTOM;
  },
): TableCell {
  const alignment = opts.center
    ? AlignmentType.CENTER
    : opts.right
      ? AlignmentType.RIGHT
      : AlignmentType.LEFT;
  const options: ITableCellOptions = {
    borders,
    width: { size: opts.width, type: WidthType.DXA },
    columnSpan: opts.colspan,
    rowSpan: opts.rowSpan,
    verticalAlign: opts.vAlign,
    shading: opts.shade ? { fill: opts.shade } : undefined,
    children: text.split("\n").map(
      (line) =>
        new Paragraph({
          alignment,
          children: [run(line, { bold: opts.bold, size: opts.size ?? 18 })],
        }),
    ),
  };
  return new TableCell(options);
}

function p(
  text: string,
  opts?: { bold?: boolean; center?: boolean; right?: boolean; size?: number },
) {
  const alignment = opts?.center
    ? AlignmentType.CENTER
    : opts?.right
      ? AlignmentType.RIGHT
      : AlignmentType.LEFT;
  return new Paragraph({
    alignment,
    spacing: { after: 80 },
    children: [run(text, { bold: opts?.bold, size: opts?.size ?? 20 })],
  });
}

/** Section label — plain black run (never HeadingLevel; Word theme turns H2 blue). */
function h(text: string) {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: BLACK, space: 4 },
    },
    children: [run(text, { bold: true, size: 22 })],
  });
}

function buildShokumu(snapshot: ExportSnapshot): Document {
  const c0 = Math.round(CONTENT * 0.14);
  const c1 = Math.round(CONTENT * 0.42);
  const c2 = Math.round(CONTENT * 0.22);
  const c3 = CONTENT - c0 - c1 - c2;
  const s0 = Math.round(CONTENT * 0.18);
  const s1 = Math.round(CONTENT * 0.28);
  const s2 = Math.round(CONTENT * 0.14);
  const s3 = CONTENT - s0 - s1 - s2;

  const children: (Paragraph | Table)[] = [
    p("職　務　経　歴　書", { bold: true, center: true, size: 32 }),
    p(snapshot.asOfShokumu, { right: true }),
    p(`氏名　　${snapshot.fullName}`, { right: true }),
    h("■職務経歴"),
    p(snapshot.jobCareerLine),
    h("■職務要約"),
    p(snapshot.jobSummary),
    h("■活かせる経験・知識"),
    ...snapshot.strengths.map((s) => p(`・${s}`)),
    h("■職務詳細"),
  ];

  for (const e of snapshot.employers) {
    children.push(p(e.header, { bold: true }));
    if (e.meta) children.push(p(e.meta));
  }

  children.push(
    new Table({
      width: { size: CONTENT, type: WidthType.DXA },
      columnWidths: [c0, c1, c2, c3],
      rows: [
        new TableRow({
          children: [
            cell("期間", { width: c0, bold: true, shade: "F3F3F3" }),
            cell("業務内容", { width: c1, bold: true, shade: "F3F3F3" }),
            cell("開発環境", { width: c2, bold: true, shade: "F3F3F3" }),
            cell("規模/役割", { width: c3, bold: true, shade: "F3F3F3" }),
          ],
        }),
        ...snapshot.projects.map((proj) => {
          const body = [
            proj.title,
            proj.overview ? `【プロジェクト概要】\n${proj.overview}` : "",
            proj.phases ? `【担当フェーズ】\n${proj.phases}` : "",
            proj.responsibilities
              ? `【業務内容】\n${proj.responsibilities}`
              : "",
            proj.results ? `【実績・取り組み等】\n${proj.results}` : "",
          ]
            .filter(Boolean)
            .join("\n");
          return new TableRow({
            children: [
              cell(proj.period, { width: c0 }),
              cell(body, { width: c1 }),
              cell(proj.environment, { width: c2 }),
              cell(proj.roleScale, { width: c3 }),
            ],
          });
        }),
      ],
    }),
  );

  children.push(h("■資格"));
  for (const row of snapshot.licenseLines) {
    children.push(p(`・${row.year}年${row.month}月　${row.text}`));
  }
  children.push(h("■言語"));
  for (const l of snapshot.languages) {
    children.push(p(`・${l.language}（${l.level}）`));
  }
  children.push(h("■（テクニカル）スキル"));
  children.push(
    new Table({
      width: { size: CONTENT, type: WidthType.DXA },
      columnWidths: [s0, s1, s2, s3],
      rows: [
        new TableRow({
          children: [
            cell("分類", { width: s0, bold: true, shade: "F3F3F3" }),
            cell("技術", { width: s1, bold: true, shade: "F3F3F3" }),
            cell("経験", { width: s2, bold: true, shade: "F3F3F3" }),
            cell("内容", { width: s3, bold: true, shade: "F3F3F3" }),
          ],
        }),
        ...planSkillTableRows(snapshot.skillRows).map((planned) => {
          const row = planned.skill;
          const cells: TableCell[] = [];
          if (planned.categoryRowSpan !== null) {
            cells.push(
              cell(planned.category, {
                width: s0,
                vAlign: VerticalAlign.TOP,
                rowSpan:
                  planned.categoryRowSpan >= 2
                    ? planned.categoryRowSpan
                    : undefined,
              }),
            );
          }
          cells.push(
            cell(row.name, { width: s1, vAlign: VerticalAlign.TOP }),
            cell(row.yearsText, { width: s2, vAlign: VerticalAlign.TOP }),
            cell(row.description ?? "", {
              width: s3,
              vAlign: VerticalAlign.TOP,
            }),
          );
          return new TableRow({ children: cells });
        }),
      ],
    }),
  );
  children.push(h("■自己PR"), p(snapshot.selfPr));
  children.push(h("■自己研鑽（プロジェクトタイトル／リンクと同源）"));
  for (const link of snapshot.selfStudyLinks) {
    children.push(p(`・${link.label}（${link.url}）`));
  }

  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_WIDTH, height: 16838 },
            margin: {
              top: MARGIN,
              bottom: MARGIN,
              left: MARGIN,
              right: MARGIN,
            },
          },
        },
        children,
      },
    ],
  });
}

export async function buildExportDocx(
  snapshot: ExportSnapshot,
  doc: ExportDocKind,
  options?: ExportRenderOptions,
): Promise<Buffer> {
  if (doc === "rirekisho") {
    return fillRirekishoDocx(snapshot, options?.photoPrintJpeg);
  }
  const document = buildShokumu(snapshot);
  return Buffer.from(await Packer.toBuffer(document));
}
