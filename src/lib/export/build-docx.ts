import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  ImageRun,
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
import { planSkillTableRows } from "@/lib/domain/career-skills-table";
import type { ExportSnapshot } from "@/lib/domain/export-snapshot";
import {
  PHOTO_DISPLAY_HEIGHT_PX,
  PHOTO_DISPLAY_WIDTH_PX,
} from "@/lib/domain/photo-print";
import type { ExportRenderOptions } from "@/lib/export/build-export-html";
import type { ExportDocKind } from "@/lib/export/load-export-snapshot";

const PAGE_WIDTH = 11906; // A4 twips
const MARGIN = 720; // ~0.5in
const CONTENT = PAGE_WIDTH - MARGIN * 2;

const thin = {
  style: BorderStyle.SINGLE,
  size: 8,
  color: BLACK,
};
const borders = { top: thin, bottom: thin, left: thin, right: thin };
const noBorder = {
  style: BorderStyle.NONE,
  size: 0,
  color: "FFFFFF",
};
const noBorders = {
  top: noBorder,
  bottom: noBorder,
  left: noBorder,
  right: noBorder,
};

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

function photoCell(photoPrintJpeg: Buffer | null | undefined, width: number) {
  const children = photoPrintJpeg?.byteLength
    ? [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              type: "jpg",
              data: photoPrintJpeg,
              transformation: {
                width: PHOTO_DISPLAY_WIDTH_PX,
                height: PHOTO_DISPLAY_HEIGHT_PX,
              },
              altText: {
                title: "証明写真",
                description: "履歴書証明写真",
                name: "photo",
              },
            }),
          ],
        }),
      ]
    : [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 120 },
          children: [run("写真", { size: 18 })],
        }),
      ];
  // No rowSpan — Word mishandles rowspan+colspan and drops the photo
  // under the identity table (see media/my-career/11-wrong-product-export-header.png).
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.TOP,
    children,
  });
}

function buildRirekisho(
  snapshot: ExportSnapshot,
  photoPrintJpeg?: Buffer | null,
): Document {
  const wPhoto = Math.round((28 / 210) * PAGE_WIDTH);
  const wId = CONTENT - wPhoto - 80;
  const wLab = Math.round(wId * 0.22);
  const wRest = wId - wLab;
  const wYm = Math.round(CONTENT * 0.1);
  const wMm = Math.round(CONTENT * 0.08);
  const wBody = CONTENT - wYm - wMm;

  const eduRows = [
    new TableRow({
      children: [
        cell("年", { width: wYm, bold: true, center: true, shade: "F3F3F3" }),
        cell("月", { width: wMm, bold: true, center: true, shade: "F3F3F3" }),
        cell("学歴・職歴", { width: wBody, bold: true, shade: "F3F3F3" }),
      ],
    }),
    new TableRow({
      children: [
        cell("", { width: wYm }),
        cell("", { width: wMm }),
        cell("学　歴", { width: wBody, bold: true, center: true }),
      ],
    }),
    ...snapshot.educationLines.map(
      (row) =>
        new TableRow({
          children: [
            cell(row.year, { width: wYm, center: true }),
            cell(row.month, { width: wMm, center: true }),
            cell(row.text, { width: wBody }),
          ],
        }),
    ),
    new TableRow({
      children: [
        cell("", { width: wYm }),
        cell("", { width: wMm }),
        cell("職　歴", { width: wBody, bold: true, center: true }),
      ],
    }),
    ...snapshot.workLines.map(
      (row) =>
        new TableRow({
          children: [
            cell(row.year, { width: wYm, center: true }),
            cell(row.month, { width: wMm, center: true }),
            cell(row.text, { width: wBody }),
          ],
        }),
    ),
    ...(snapshot.workLines.length > 0
      ? [
          new TableRow({
            children: [
              cell("", { width: wYm }),
              cell("", { width: wMm }),
              cell("現在に至る", { width: wBody }),
            ],
          }),
        ]
      : []),
    new TableRow({
      children: [
        cell("", { width: wYm }),
        cell("", { width: wMm }),
        cell("以上", { width: wBody, right: true }),
      ],
    }),
  ];

  const wBirth = Math.round(wRest * 0.72);
  const wGender = wRest - wBirth;
  const wBikoLeft = Math.round(CONTENT * 0.52);
  const wBikoLab = Math.round(CONTENT * 0.12);
  const wBikoVal = Math.round(CONTENT * 0.12);
  const wBikoLabWide = Math.round(CONTENT * 0.14);
  const wBikoValWide =
    CONTENT - wBikoLeft - wBikoLab - wBikoVal - wBikoLabWide;
  const commuteText = snapshot.commuteLine || "約　　時間　　分";

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
        children: [
          // Outer 2-col: left = title/date + identity, right = photo.
          // Avoid rowspan/colspan across photo — Word drops it bottom-left.
          new Table({
            width: { size: CONTENT, type: WidthType.DXA },
            columnWidths: [wId, wPhoto],
            borders: {
              top: noBorder,
              bottom: noBorder,
              left: noBorder,
              right: noBorder,
              insideHorizontal: noBorder,
              insideVertical: noBorder,
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    borders: noBorders,
                    width: { size: wId, type: WidthType.DXA },
                    children: [
                      new Table({
                        width: { size: wId, type: WidthType.DXA },
                        columnWidths: [
                          Math.round(wId * 0.55),
                          Math.round(wId * 0.45),
                        ],
                        rows: [
                          new TableRow({
                            children: [
                              new TableCell({
                                borders: noBorders,
                                width: {
                                  size: Math.round(wId * 0.55),
                                  type: WidthType.DXA,
                                },
                                children: [
                                  new Paragraph({
                                    alignment: AlignmentType.LEFT,
                                    spacing: { after: 60 },
                                    children: [
                                      run("履　歴　書", {
                                        bold: true,
                                        size: 32,
                                      }),
                                    ],
                                  }),
                                ],
                              }),
                              new TableCell({
                                borders: noBorders,
                                width: {
                                  size: Math.round(wId * 0.45),
                                  type: WidthType.DXA,
                                },
                                verticalAlign: VerticalAlign.BOTTOM,
                                children: [
                                  new Paragraph({
                                    alignment: AlignmentType.RIGHT,
                                    spacing: { after: 60 },
                                    children: [
                                      run(snapshot.asOfRirekisho, {
                                        size: 20,
                                      }),
                                    ],
                                  }),
                                ],
                              }),
                            ],
                          }),
                        ],
                      }),
                      new Table({
                        width: { size: wId, type: WidthType.DXA },
                        columnWidths: [wLab, wBirth, wGender],
                        rows: [
                          new TableRow({
                            height: {
                              value: 400,
                              rule: HeightRule.ATLEAST,
                            },
                            children: [
                              cell("ふりがな", {
                                width: wLab,
                                bold: true,
                                shade: "F3F3F3",
                                size: 16,
                                vAlign: VerticalAlign.CENTER,
                              }),
                              cell(snapshot.fullNameKana, {
                                width: wBirth + wGender,
                                colspan: 2,
                                size: 16,
                                vAlign: VerticalAlign.CENTER,
                              }),
                            ],
                          }),
                          new TableRow({
                            height: {
                              value: 900,
                              rule: HeightRule.ATLEAST,
                            },
                            children: [
                              cell("氏　名", {
                                width: wLab,
                                bold: true,
                                shade: "F3F3F3",
                                size: 24,
                                vAlign: VerticalAlign.CENTER,
                              }),
                              cell(snapshot.fullName, {
                                width: wBirth + wGender,
                                colspan: 2,
                                size: 24,
                                vAlign: VerticalAlign.CENTER,
                              }),
                            ],
                          }),
                          new TableRow({
                            height: {
                              value: 720,
                              rule: HeightRule.ATLEAST,
                            },
                            children: [
                              cell("生年月日", {
                                width: wLab,
                                bold: true,
                                shade: "F3F3F3",
                                vAlign: VerticalAlign.CENTER,
                              }),
                              cell(snapshot.birthLine, {
                                width: wBirth,
                                vAlign: VerticalAlign.CENTER,
                              }),
                              cell(
                                snapshot.gender
                                  ? `※性別　${snapshot.gender}`
                                  : "",
                                {
                                  width: wGender,
                                  vAlign: VerticalAlign.CENTER,
                                },
                              ),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                  photoCell(photoPrintJpeg, wPhoto),
                ],
              }),
            ],
          }),
          new Paragraph({ children: [] }),
          (() => {
            const wAddrLab = Math.round(CONTENT * 0.12);
            const wAddrBody = Math.round(CONTENT * 0.46);
            const wSideLab = Math.round(CONTENT * 0.1);
            const wSideVal = CONTENT - wAddrLab - wAddrBody - wSideLab;
            return new Table({
              width: { size: CONTENT, type: WidthType.DXA },
              columnWidths: [wAddrLab, wAddrBody, wSideLab, wSideVal],
              rows: [
                new TableRow({
                  children: [
                    cell("ふりがな", {
                      width: wAddrLab,
                      bold: true,
                      shade: "F3F3F3",
                    }),
                    cell(snapshot.addressKana, { width: wAddrBody }),
                    cell("電話", {
                      width: wSideLab,
                      bold: true,
                      shade: "F3F3F3",
                    }),
                    cell(snapshot.phone, { width: wSideVal }),
                  ],
                }),
                new TableRow({
                  children: [
                    cell("現住所", {
                      width: wAddrLab,
                      bold: true,
                      shade: "F3F3F3",
                    }),
                    cell(snapshot.address, { width: wAddrBody }),
                    cell("E-mail", {
                      width: wSideLab,
                      bold: true,
                      shade: "F3F3F3",
                    }),
                    cell(snapshot.email, { width: wSideVal }),
                  ],
                }),
              ],
            });
          })(),
          new Paragraph({ children: [] }),
          new Table({
            width: { size: CONTENT, type: WidthType.DXA },
            columnWidths: [wYm, wMm, wBody],
            rows: eduRows,
          }),
          new Paragraph({ children: [] }),
          new Table({
            width: { size: CONTENT, type: WidthType.DXA },
            columnWidths: [wYm, wMm, wBody],
            rows: [
              new TableRow({
                children: [
                  cell("年", {
                    width: wYm,
                    bold: true,
                    center: true,
                    shade: "F3F3F3",
                  }),
                  cell("月", {
                    width: wMm,
                    bold: true,
                    center: true,
                    shade: "F3F3F3",
                  }),
                  cell("免許・資格", {
                    width: wBody,
                    bold: true,
                    shade: "F3F3F3",
                  }),
                ],
              }),
              ...snapshot.licenseLines.map(
                (row) =>
                  new TableRow({
                    children: [
                      cell(row.year, { width: wYm, center: true }),
                      cell(row.month, { width: wMm, center: true }),
                      cell(row.text, { width: wBody }),
                    ],
                  }),
              ),
            ],
          }),
          new Paragraph({ children: [] }),
          new Table({
            width: { size: CONTENT, type: WidthType.DXA },
            columnWidths: [
              wBikoLeft,
              wBikoLab,
              wBikoVal,
              wBikoLabWide,
              wBikoValWide,
            ],
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    borders,
                    width: { size: wBikoLeft, type: WidthType.DXA },
                    rowSpan: 4,
                    children: [
                      new Paragraph({
                        children: [run("備考：", { bold: true, size: 18 })],
                      }),
                      ...snapshot.residenceLines.map(
                        (line) =>
                          new Paragraph({
                            children: [run(line, { size: 18 })],
                          }),
                      ),
                    ],
                  }),
                  cell("最寄り", { width: wBikoLab, center: true }),
                  cell(snapshot.nearestStation, {
                    width: wBikoVal + wBikoLabWide + wBikoValWide,
                    colspan: 3,
                    center: true,
                  }),
                ],
              }),
              new TableRow({
                children: [
                  cell("通勤時間", { width: wBikoLab, center: true }),
                  cell(commuteText, {
                    width: wBikoVal + wBikoLabWide + wBikoValWide,
                    colspan: 3,
                    center: true,
                  }),
                ],
              }),
              new TableRow({
                children: [
                  cell("扶養家族数（配偶者を除く）", {
                    width: wBikoLab + wBikoVal,
                    colspan: 2,
                    center: true,
                  }),
                  cell(snapshot.dependentsLine, {
                    width: wBikoLabWide + wBikoValWide,
                    colspan: 2,
                    center: true,
                  }),
                ],
              }),
              new TableRow({
                children: [
                  cell("配偶者", { width: wBikoLab, center: true }),
                  cell(snapshot.hasSpouseLabel, {
                    width: wBikoVal,
                    center: true,
                  }),
                  cell("配偶者の扶養義務", {
                    width: wBikoLabWide,
                    center: true,
                  }),
                  cell(snapshot.spouseDependentLabel, {
                    width: wBikoValWide,
                    center: true,
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
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
  const document =
    doc === "rirekisho"
      ? buildRirekisho(snapshot, options?.photoPrintJpeg)
      : buildShokumu(snapshot);
  return Buffer.from(await Packer.toBuffer(document));
}
