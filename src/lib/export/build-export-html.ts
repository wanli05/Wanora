import type { ExportSnapshot } from "@/lib/domain/export-snapshot";
import type { ExportDocKind } from "@/lib/export/load-export-snapshot";

function esc(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function nl(text: string): string {
  return esc(text).replaceAll("\n", "<br/>");
}

const CSS = `
@page { size: A4; margin: 12mm; }
body { margin: 0; font-family: "Noto Serif JP", "Yu Mincho", "Hiragino Mincho ProN", serif; font-size: 11.5px; line-height: 1.45; color: #111; }
.sheet { width: 100%; }
h1 { margin: 0 0 6px; text-align: center; font-size: 20px; letter-spacing: 0.4em; font-weight: 600; }
.meta { text-align: right; margin: 0 0 2px; font-size: 12px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
th, td { border: 1px solid #333; padding: 4px 6px; vertical-align: top; }
.lab { width: 18%; background: #f3f3f3; font-weight: 600; white-space: nowrap; }
.ym { width: 12mm; text-align: center; }
.mm { width: 10mm; text-align: center; }
.center { text-align: center; font-weight: 600; letter-spacing: 0.4em; }
.right { text-align: right; }
h2 { margin: 14px 0 6px; font-size: 13px; font-weight: 700; border-bottom: 1px solid #222; padding-bottom: 2px; }
.company { font-weight: 700; margin: 8px 0 2px; }
.subh { font-weight: 700; margin-top: 4px; }
a { color: #0a4d8c; word-break: break-all; }
ul { margin: 0 0 8px; padding-left: 1.2em; }
`;

function rirekishoHtml(s: ExportSnapshot): string {
  const edu = s.educationLines
    .map(
      (r) =>
        `<tr><td class="ym">${esc(r.year)}</td><td class="mm">${esc(r.month)}</td><td>${esc(r.text)}</td></tr>`,
    )
    .join("");
  const work = s.workLines
    .map(
      (r) =>
        `<tr><td class="ym">${esc(r.year)}</td><td class="mm">${esc(r.month)}</td><td>${esc(r.text)}</td></tr>`,
    )
    .join("");
  const licenses = s.licenseLines
    .map(
      (r) =>
        `<tr><td class="ym">${esc(r.year)}</td><td class="mm">${esc(r.month)}</td><td>${esc(r.text)}</td></tr>`,
    )
    .join("");
  const salary = s.salaryLines
    .map((line) => `<tr><td colspan="2">${esc(line)}</td></tr>`)
    .join("");
  const langs = s.languages
    .map((l) => `${esc(l.language)}（${esc(l.level)}）`)
    .join("　／　");

  return `
  <article class="sheet">
    <h1>履　歴　書</h1>
    <p class="meta">${esc(s.asOfRirekisho)}</p>
    <table>
      <tr><td class="lab">ふりがな</td><td colspan="3">${esc(s.fullNameKana)}</td></tr>
      <tr><td class="lab">氏　名</td><td colspan="3">${esc(s.fullName)}</td></tr>
      <tr><td class="lab">生年月日</td><td>${esc(s.birthLine)}</td><td class="lab">性別</td><td>${esc(s.gender)}</td></tr>
      <tr><td class="lab">現住所</td><td colspan="3">${nl([s.addressKana, s.address].filter(Boolean).join("\n"))}</td></tr>
      <tr><td class="lab">電話</td><td colspan="3">${esc(s.phone)}</td></tr>
      <tr><td class="lab">E-mail</td><td colspan="3">${esc(s.email)}</td></tr>
    </table>
    <table>
      <tr><th class="ym">年</th><th class="mm">月</th><th>学歴・職歴</th></tr>
      <tr><td></td><td></td><td class="center">学　歴</td></tr>
      ${edu}
      <tr><td></td><td></td><td class="center">職　歴</td></tr>
      ${work}
      ${s.workLines.length > 0 ? `<tr><td></td><td></td><td>現在に至る</td></tr>` : ""}
      <tr><td></td><td></td><td class="right">以上</td></tr>
    </table>
    <table>
      <tr><th class="ym">年</th><th class="mm">月</th><th>免許・資格</th></tr>
      ${licenses}
      <tr><td class="lab">備考</td><td colspan="2">${nl(s.residenceLines.join("\n"))}</td></tr>
    </table>
    <table>
      <tr><td class="lab" colspan="2">現在の給与条件</td></tr>
      ${salary}
    </table>
    <table>
      <tr><td class="lab">語学レベル</td></tr>
      <tr><td>${langs}</td></tr>
    </table>
    <table>
      <tr><td class="lab">本人希望記入欄（特に給料・職種・勤務時間・勤務地・その他についての希望などがあれば記入）</td></tr>
      <tr><td>${nl(s.personalHope)}</td></tr>
    </table>
  </article>`;
}

function shokumuHtml(s: ExportSnapshot): string {
  const strengths = s.strengths.map((x) => `<li>${esc(x)}</li>`).join("");
  const employers = s.employers
    .map(
      (e) =>
        `<p class="company">${esc(e.header)}</p>${e.meta ? `<p>${esc(e.meta)}</p>` : ""}`,
    )
    .join("");
  const projects = s.projects
    .map((p) => {
      const title = p.titleUrl
        ? `<a href="${esc(p.titleUrl)}">${esc(p.title)}</a>`
        : esc(p.title);
      return `<tr>
        <td>${nl(p.period)}</td>
        <td>
          <div><strong>${title}</strong></div>
          ${p.overview ? `<div class="subh">【プロジェクト概要】</div>${nl(p.overview)}` : ""}
          ${p.phases ? `<div class="subh">【担当フェーズ】</div>${nl(p.phases)}` : ""}
          ${p.responsibilities ? `<div class="subh">【業務内容】</div>${nl(p.responsibilities)}` : ""}
          ${p.results ? `<div class="subh">【実績・取り組み等】</div>${nl(p.results)}` : ""}
        </td>
        <td>${nl(p.environment)}</td>
        <td>${nl(p.roleScale)}</td>
      </tr>`;
    })
    .join("");
  const licenses = s.licenseLines
    .map((r) => `<li>${esc(r.year)}年${esc(r.month)}月　${esc(r.text)}</li>`)
    .join("");
  const langs = s.languages
    .map((l) => `<li>${esc(l.language)}（${esc(l.level)}）</li>`)
    .join("");
  const skills = s.skillRows
    .map(
      (r) =>
        `<tr><td>${esc(r.category)}</td><td>${esc(r.name)}</td><td>${esc(r.yearsText)}</td><td>${esc(r.description ?? "")}</td></tr>`,
    )
    .join("");
  const links = s.selfStudyLinks
    .map(
      (l) =>
        `<li><a href="${esc(l.url)}">${esc(l.label)}</a></li>`,
    )
    .join("");

  return `
  <article class="sheet">
    <h1>職　務　経　歴　書</h1>
    <p class="meta">${esc(s.asOfShokumu)}</p>
    <p class="meta">氏名　　${esc(s.fullName)}</p>
    <h2>■職務経歴</h2>
    <p>${nl(s.jobCareerLine)}</p>
    <h2>■職務要約</h2>
    <p>${nl(s.jobSummary)}</p>
    <h2>■活かせる経験・知識</h2>
    <ul>${strengths}</ul>
    <h2>■職務詳細</h2>
    ${employers}
    <table>
      <thead><tr><th>期間</th><th>業務内容</th><th>開発環境</th><th>規模/役割</th></tr></thead>
      <tbody>${projects}</tbody>
    </table>
    <h2>■資格</h2>
    <ul>${licenses}</ul>
    <h2>■言語</h2>
    <ul>${langs}</ul>
    <h2>■（テクニカル）スキル</h2>
    <table>
      <thead><tr><th>分類</th><th>技術</th><th>経験</th><th>内容</th></tr></thead>
      <tbody>${skills}</tbody>
    </table>
    <h2>■自己PR</h2>
    <p>${nl(s.selfPr)}</p>
    <h2>■自己研鑽（プロジェクトタイトル／リンクと同源）</h2>
    <ul>${links}</ul>
  </article>`;
}

/** Self-contained HTML aligned to export-final / ExportSheets for PDF printing. */
export function buildExportHtml(
  snapshot: ExportSnapshot,
  doc: ExportDocKind,
): string {
  const body =
    doc === "rirekisho" ? rirekishoHtml(snapshot) : shokumuHtml(snapshot);
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"/><style>${CSS}</style></head><body>${body}</body></html>`;
}
