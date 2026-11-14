import type { ExportSnapshot } from "@/lib/domain/export-snapshot";
import type { ExportDocKind } from "@/lib/export/load-export-snapshot";

export type ExportRenderOptions = {
  /** 30×40mm@300dpi JPEG bytes for 履歴書写真; omit/null → empty frame. */
  photoPrintJpeg?: Buffer | null;
};

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

function photoDataUrl(buf: Buffer | null | undefined): string | null {
  if (!buf?.byteLength) return null;
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

const CSS = `
@page { size: A4; margin: 12mm; }
body { margin: 0; font-family: "Noto Serif JP", "Yu Mincho", "Hiragino Mincho ProN", serif; font-size: 11.5px; line-height: 1.45; color: #111; }
.sheet { width: 100%; }
.rk-head { display: grid; grid-template-columns: 1fr 28mm; gap: 8px; align-items: start; margin-bottom: 8px; }
h1 { margin: 0 0 6px; text-align: center; font-size: 22px; letter-spacing: 0.45em; font-weight: 600; color: #000; }
.meta { text-align: right; margin: 0 0 8px; font-size: 12px; color: #000; }
.photo { width: 28mm; height: 36mm; border: 1px solid #000; display: grid; place-items: center; font-size: 10px; color: #888; background: #fafafa; overflow: hidden; }
.photo img { width: 100%; height: 100%; object-fit: cover; }
table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
th, td { border: 1px solid #000; padding: 4px 6px; vertical-align: top; color: #000; }
.lab { width: 18%; background: #f3f3f3; font-weight: 600; white-space: nowrap; }
.ym { width: 12mm; text-align: center; }
.mm { width: 10mm; text-align: center; }
.center { text-align: center; font-weight: 600; letter-spacing: 0.4em; }
.right { text-align: right; }
h2 { margin: 14px 0 6px; font-size: 13px; font-weight: 700; color: #000; border-bottom: 1px solid #000; padding-bottom: 2px; }
.company { font-weight: 700; margin: 8px 0 2px; }
.subh { font-weight: 700; margin-top: 4px; }
a { color: #0a4d8c; word-break: break-all; }
ul { margin: 0 0 8px; padding-left: 1.2em; }
.biko-wrap { width: 100%; border-collapse: collapse; margin-bottom: 8px; table-layout: fixed; }
.biko-wrap td { border: 1px solid #000; padding: 6px 5px; vertical-align: middle; text-align: center; }
.biko-left { width: 52%; text-align: left; vertical-align: top; padding: 8px 10px; }
.biko-title { font-weight: 700; margin-bottom: 4px; }
.biko-lab { font-size: 10.5px; width: 18%; }
.biko-val { font-size: 12px; width: 14%; }
.biko-lab-wide { font-size: 10.5px; width: 22%; }
.biko-val-wide { font-size: 12px; width: 26%; }
`;

function rirekishoHtml(s: ExportSnapshot, photoJpeg?: Buffer | null): string {
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
  const dataUrl = photoDataUrl(photoJpeg);
  const photoBlock = dataUrl
    ? `<div class="photo"><img src="${dataUrl}" alt="証明写真"/></div>`
    : `<div class="photo">写真</div>`;
  const commuteCell = s.commuteLine || "約　　時間　　分";

  return `
  <article class="sheet">
    <h1>履　歴　書</h1>
    <p class="meta">${esc(s.asOfRirekisho)}</p>
    <div class="rk-head">
      <table>
        <tr><td class="lab">ふりがな</td><td colspan="3">${esc(s.fullNameKana)}</td></tr>
        <tr><td class="lab">氏　名</td><td colspan="3">${esc(s.fullName)}</td></tr>
        <tr><td class="lab">生年月日</td><td colspan="2">${esc(s.birthLine)}</td><td>${s.gender ? `性別　${esc(s.gender)}` : ""}</td></tr>
      </table>
      ${photoBlock}
    </div>
    <table>
      <tr><td class="lab">ふりがな</td><td colspan="3">${esc(s.addressKana)}</td></tr>
      <tr><td class="lab">現住所</td><td colspan="3">${nl(s.address)}</td></tr>
      <tr><td class="lab">電話</td><td colspan="3">${esc(s.phone)}</td></tr>
      <tr><td class="lab">E-mail</td><td colspan="3">${esc(s.email)}</td></tr>
      <tr><td class="lab">最寄り</td><td colspan="3">${esc(s.nearestStation)}</td></tr>
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
    </table>
    <table class="biko-wrap">
      <tr>
        <td class="biko-left" rowspan="3">
          <div class="biko-title">備考：</div>
          ${nl(s.residenceLines.join("\n"))}
        </td>
        <td class="biko-lab">通勤時間</td>
        <td class="biko-val-wide" colspan="3">${esc(commuteCell)}</td>
      </tr>
      <tr>
        <td class="biko-lab-wide" colspan="2">扶養家族数（配偶者を除く）</td>
        <td class="biko-val-wide" colspan="2">${esc(s.dependentsLine)}</td>
      </tr>
      <tr>
        <td class="biko-lab">配偶者</td>
        <td class="biko-val">${esc(s.hasSpouseLabel)}</td>
        <td class="biko-lab-wide">配偶者の扶養義務</td>
        <td class="biko-val">${esc(s.spouseDependentLabel)}</td>
      </tr>
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
    <h1 style="letter-spacing:0.4em;font-size:20px;color:#000">職　務　経　歴　書</h1>
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

export function buildExportHtml(
  snapshot: ExportSnapshot,
  doc: ExportDocKind,
  options?: ExportRenderOptions,
): string {
  const body =
    doc === "rirekisho"
      ? rirekishoHtml(snapshot, options?.photoPrintJpeg)
      : shokumuHtml(snapshot);
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"/><style>${CSS}</style></head><body>${body}</body></html>`;
}
