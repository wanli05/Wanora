import {
  DOMParser,
  XMLSerializer,
  type Document as XmlDocument,
  type Element as XmlElement,
  type Node as XmlNode,
} from "@xmldom/xmldom";
import JSZip from "jszip";
import type { ExportSnapshot } from "@/lib/domain/export-snapshot";
import {
  RIREKISHO_GRIDS,
  RIREKISHO_PAGE,
  RIREKISHO_PHOTO_EMU,
  RIREKISHO_RECORD_ROW_HEIGHT_TWIPS,
  loadRirekishoTemplateBytes,
} from "@/lib/export/rirekisho-template";

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R_NS =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
const WP_NS =
  "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const PIC_NS = "http://schemas.openxmlformats.org/drawingml/2006/picture";
const REL_NS =
  "http://schemas.openxmlformats.org/package/2006/relationships";
const CT_NS =
  "http://schemas.openxmlformats.org/package/2006/content-types";

const PHOTO_REL_ID = "rIdPhotoWanora";
const PHOTO_MEDIA_PATH = "word/media/wanora_photo.jpeg";

export type HistoryLine = {
  year: string;
  month: string;
  text: string;
  /** Section banner like 学歴 / 職歴 / 以上 — year/month cells stay empty. */
  banner?: boolean;
};

/** Fields kept in the profile DB but not mapped onto the MHLW blank form. */
export const RIREKISHO_FIELDS_NOT_ON_TEMPLATE = [
  "residenceLines（在留資格・在留期間）",
  "salaryLines（給与）",
  "languages（語学）",
  "nearestStation / commuteLine（通勤）",
  "dependentsLine / hasSpouseLabel / spouseDependentLabel（配偶者・扶養）",
  "jobSummary / strengths（職務要約・強み — 履歴書自己PR欄以外）",
  "employers / projects / skillRows / selfStudyLinks（職務経歴書側）",
] as const;

function children(el: XmlElement, local: string, ns = W_NS): XmlElement[] {
  const out: XmlElement[] = [];
  for (let i = 0; i < el.childNodes.length; i++) {
    const n = el.childNodes[i];
    if (n.nodeType === 1 && (n as XmlElement).namespaceURI === ns) {
      if ((n as XmlElement).localName === local) out.push(n as XmlElement);
    }
  }
  return out;
}

function firstChild(el: XmlElement, local: string, ns = W_NS): XmlElement | null {
  return children(el, local, ns)[0] ?? null;
}

function tables(body: XmlElement): XmlElement[] {
  return children(body, "tbl");
}

function rows(tbl: XmlElement): XmlElement[] {
  return children(tbl, "tr");
}

function cells(tr: XmlElement): XmlElement[] {
  return children(tr, "tc");
}

function paragraphs(tc: XmlElement): XmlElement[] {
  return children(tc, "p");
}

function textOf(el: XmlElement): string {
  let s = "";
  const walk = (n: XmlNode) => {
    if (n.nodeType === 1 && (n as XmlElement).localName === "t") {
      s += n.textContent ?? "";
    }
    for (let i = 0; i < n.childNodes.length; i++) walk(n.childNodes[i]!);
  };
  walk(el);
  return s;
}

/** Replace all runs in a paragraph with a single run carrying `text`. */
function setParagraphText(p: XmlElement, doc: XmlDocument, text: string): void {
  const existingRuns = children(p, "r");
  let rPrClone: XmlElement | null = null;
  if (existingRuns[0]) {
    const rPr = firstChild(existingRuns[0], "rPr");
    if (rPr) rPrClone = rPr.cloneNode(true) as XmlElement;
  }
  for (const r of existingRuns) p.removeChild(r);
  // Drop leftover hyperlinks etc. that only wrap text — keep pPr.
  const run = doc.createElementNS(W_NS, "w:r");
  if (rPrClone) run.appendChild(rPrClone);
  else {
    const rPr = doc.createElementNS(W_NS, "w:rPr");
    const fonts = doc.createElementNS(W_NS, "w:rFonts");
    fonts.setAttribute("w:ascii", "ＭＳ 明朝");
    fonts.setAttribute("w:hAnsi", "ＭＳ 明朝");
    fonts.setAttribute("w:hint", "eastAsia");
    rPr.appendChild(fonts);
    run.appendChild(rPr);
  }
  const t = doc.createElementNS(W_NS, "w:t");
  t.setAttribute("xml:space", "preserve");
  t.textContent = text;
  run.appendChild(t);
  p.appendChild(run);
}

function setCellPlainText(tc: XmlElement, doc: XmlDocument, text: string): void {
  const ps = paragraphs(tc);
  if (ps.length === 0) {
    const p = doc.createElementNS(W_NS, "w:p");
    tc.appendChild(p);
    setParagraphText(p, doc, text);
    return;
  }
  setParagraphText(ps[0]!, doc, text);
  for (let i = 1; i < ps.length; i++) {
    setParagraphText(ps[i]!, doc, "");
  }
}

/** Keep label paragraph; put value into the next empty paragraph (or append). */
function setCellValueAfterLabel(
  tc: XmlElement,
  doc: XmlDocument,
  value: string,
): void {
  const ps = paragraphs(tc);
  if (ps.length >= 2) {
    setParagraphText(ps[1]!, doc, value);
    return;
  }
  if (ps.length === 1) {
    const p = doc.createElementNS(W_NS, "w:p");
    const pPr = firstChild(ps[0]!, "pPr");
    if (pPr) p.appendChild(pPr.cloneNode(true));
    tc.appendChild(p);
    setParagraphText(p, doc, value);
    return;
  }
  setCellPlainText(tc, doc, value);
}

function setAddressCell(
  tc: XmlElement,
  doc: XmlDocument,
  postalCode: string,
  address: string,
): void {
  const ps = paragraphs(tc);
  const zipLine = postalCode
    ? `〒${postalCode.replace(/^〒/, "")}`
    : "〒";
  if (ps[0]) setParagraphText(ps[0], doc, zipLine);
  else setCellPlainText(tc, doc, zipLine);
  // Strip leading 〒 line from snapshot.address if present.
  const body = address
    .split("\n")
    .filter((l) => l.trim() && !/^〒/.test(l.trim()))
    .join("\n");
  if (ps[1]) setParagraphText(ps[1], doc, body);
  else if (body) setCellValueAfterLabel(tc, doc, body);
}

function setPhoneCell(tc: XmlElement, doc: XmlDocument, phone: string): void {
  const ps = paragraphs(tc);
  if (!ps[0]) {
    setCellPlainText(tc, doc, phone ? `電話 ${phone}` : "電話 ");
    return;
  }
  // Preserve label run style by rewriting whole paragraph.
  setParagraphText(ps[0], doc, phone ? `電話 ${phone}` : "電話 ");
}

function cloneEmptyHistoryRow(sample: XmlElement, doc: XmlDocument): XmlElement {
  const tr = sample.cloneNode(true) as XmlElement;
  for (const tc of cells(tr)) {
    for (const p of paragraphs(tc)) setParagraphText(p, doc, "");
  }
  return tr;
}

function writeHistoryRow(
  tr: XmlElement,
  doc: XmlDocument,
  line: HistoryLine,
): void {
  const cs = cells(tr);
  if (cs.length < 3) return;
  if (line.banner) {
    setCellPlainText(cs[0]!, doc, "");
    setCellPlainText(cs[1]!, doc, "");
    setCellPlainText(cs[2]!, doc, line.text);
    return;
  }
  setCellPlainText(cs[0]!, doc, line.year);
  setCellPlainText(cs[1]!, doc, line.month);
  setCellPlainText(cs[2]!, doc, line.text);
}

export function buildRirekishoHistoryLines(
  snapshot: ExportSnapshot,
): HistoryLine[] {
  const lines: HistoryLine[] = [];
  lines.push({ year: "", month: "", text: "学　歴", banner: true });
  for (const row of snapshot.educationLines) {
    lines.push({ year: row.year, month: row.month, text: row.text });
  }
  lines.push({ year: "", month: "", text: "職　歴", banner: true });
  for (const row of snapshot.workLines) {
    lines.push({ year: row.year, month: row.month, text: row.text });
  }
  if (snapshot.workLines.length > 0) {
    const last = snapshot.workLines[snapshot.workLines.length - 1];
    // Existing product rule: show 現在に至る when any work history exists
    // (open-ended employer already encoded as no leave event in workLines).
    if (last) {
      lines.push({ year: "", month: "", text: "現在に至る" });
    }
  }
  lines.push({ year: "", month: "", text: "以上", banner: true });
  return lines;
}

function fillIdentity(
  tbl: XmlElement,
  doc: XmlDocument,
  snapshot: ExportSnapshot,
): void {
  const trs = rows(tbl);
  // r0 c1 — 年月日現在
  setCellPlainText(cells(trs[0]!)[1]!, doc, snapshot.asOfRirekisho);
  // r1 c1 — 氏名ふりがな
  setCellPlainText(cells(trs[1]!)[1]!, doc, snapshot.fullNameKana);
  // r2 c1 — 氏名
  setCellPlainText(cells(trs[2]!)[1]!, doc, snapshot.fullName);
  // r3 c1 — birth
  if (snapshot.birthLine) {
    setCellPlainText(cells(trs[3]!)[1]!, doc, snapshot.birthLine);
  }
  // r3 c2 — gender value under ※性別
  if (snapshot.gender) {
    setCellValueAfterLabel(cells(trs[3]!)[2]!, doc, snapshot.gender);
  }
  // r4 — address kana + phone
  setCellPlainText(cells(trs[4]!)[1]!, doc, snapshot.addressKana);
  setPhoneCell(cells(trs[4]!)[2]!, doc, snapshot.phone);
  // r5 — 現住所 (postal once) + email
  setAddressCell(
    cells(trs[5]!)[1]!,
    doc,
    snapshot.postalCode,
    snapshot.address,
  );
  setCellValueAfterLabel(cells(trs[5]!)[2]!, doc, snapshot.email);
  // r6–r7 連絡先: leave template blank + original note (do not repeat 現住所).
}

function fillHistorySlots(
  slotRows: XmlElement[],
  doc: XmlDocument,
  lines: HistoryLine[],
): HistoryLine[] {
  const capacity = slotRows.length;
  const fitted = lines.slice(0, capacity);
  const rest = lines.slice(capacity);
  for (let i = 0; i < capacity; i++) {
    const line = fitted[i];
    if (line) writeHistoryRow(slotRows[i]!, doc, line);
    else writeHistoryRow(slotRows[i]!, doc, { year: "", month: "", text: "" });
  }
  return rest;
}

function fillLicenses(
  tbl: XmlElement,
  doc: XmlDocument,
  snapshot: ExportSnapshot,
): void {
  const trs = rows(tbl);
  // r8 = header, r9.. = slots
  const licenseHeaderIdx = trs.findIndex((tr) =>
    textOf(tr).includes("免　許・資　格") || textOf(tr).includes("免許・資格"),
  );
  if (licenseHeaderIdx < 0) return;
  let slots = trs.slice(licenseHeaderIdx + 1);
  const sample = slots[0] ?? trs[1];
  while (slots.length < snapshot.licenseLines.length && sample) {
    const neu = cloneEmptyHistoryRow(sample, doc);
    tbl.appendChild(neu);
    slots = rows(tbl).slice(licenseHeaderIdx + 1);
  }
  for (let i = 0; i < slots.length; i++) {
    const line = snapshot.licenseLines[i];
    if (line) {
      writeHistoryRow(slots[i]!, doc, {
        year: line.year,
        month: line.month,
        text: line.text,
      });
    } else {
      writeHistoryRow(slots[i]!, doc, { year: "", month: "", text: "" });
    }
  }
}

function makeContinuationTable(
  doc: XmlDocument,
  sampleTbl: XmlElement,
  lines: HistoryLine[],
): XmlElement {
  const tbl = sampleTbl.cloneNode(false) as XmlElement;
  // Copy tblPr + tblGrid from sample
  for (let i = 0; i < sampleTbl.childNodes.length; i++) {
    const n = sampleTbl.childNodes[i]!;
    if (n.nodeType !== 1) continue;
    const el = n as XmlElement;
    if (el.localName === "tblPr" || el.localName === "tblGrid") {
      tbl.appendChild(el.cloneNode(true));
    }
  }
  const sampleRows = rows(sampleTbl);
  const header = sampleRows[0]!.cloneNode(true) as XmlElement;
  tbl.appendChild(header);
  const sampleData = sampleRows[1] ?? sampleRows[0]!;
  for (const line of lines) {
    const tr = cloneEmptyHistoryRow(sampleData, doc);
    // Force exact 567 height
    let trPr = firstChild(tr, "trPr");
    if (!trPr) {
      trPr = doc.createElementNS(W_NS, "w:trPr");
      tr.insertBefore(trPr, tr.firstChild);
    }
    let trHeight = firstChild(trPr, "trHeight");
    if (!trHeight) {
      trHeight = doc.createElementNS(W_NS, "w:trHeight");
      trPr.appendChild(trHeight);
    }
    trHeight.setAttribute("w:hRule", "exact");
    trHeight.setAttribute("w:val", String(RIREKISHO_RECORD_ROW_HEIGHT_TWIPS));
    writeHistoryRow(tr, doc, line);
    tbl.appendChild(tr);
  }
  return tbl;
}

function insertPageBreakBefore(ref: XmlElement, doc: XmlDocument): void {
  const p = doc.createElementNS(W_NS, "w:p");
  const r = doc.createElementNS(W_NS, "w:r");
  const br = doc.createElementNS(W_NS, "w:br");
  br.setAttribute("w:type", "page");
  r.appendChild(br);
  p.appendChild(r);
  ref.parentNode!.insertBefore(p, ref);
}

const MC_NS = "http://schemas.openxmlformats.org/markup-compatibility/2006";

function clearPhotoPlaceholderText(root: XmlElement): void {
  const walk = (n: XmlNode) => {
    if (n.nodeType === 1 && (n as XmlElement).localName === "t") {
      const cur = n.textContent ?? "";
      if (/写真/.test(cur)) n.textContent = "";
    }
    for (let i = 0; i < n.childNodes.length; i++) walk(n.childNodes[i]!);
  };
  walk(root);
}

function replacePhotoWithJpeg(doc: XmlDocument, hasPhoto: boolean): void {
  if (!hasPhoto) return; // keep placeholder shape + 「写真を貼る位置」
  const drawings = doc.getElementsByTagNameNS(W_NS, "drawing");
  const drawing = drawings[0] as XmlElement | undefined;
  if (!drawing) return;
  const anchors = drawing.getElementsByTagNameNS(WP_NS, "anchor");
  const anchor = anchors[0] as XmlElement | undefined;
  if (!anchor) return;

  // Clear graphic payload; rebuild as pic referencing PHOTO_REL_ID.
  const graphics = anchor.getElementsByTagNameNS(A_NS, "graphic");
  const graphic = graphics[0] as XmlElement | undefined;
  if (!graphic) return;
  while (graphic.firstChild) graphic.removeChild(graphic.firstChild);

  const graphicData = doc.createElementNS(A_NS, "a:graphicData");
  graphicData.setAttribute(
    "uri",
    "http://schemas.openxmlformats.org/drawingml/2006/picture",
  );
  const pic = doc.createElementNS(PIC_NS, "pic:pic");
  const nvPicPr = doc.createElementNS(PIC_NS, "pic:nvPicPr");
  const cNvPr = doc.createElementNS(PIC_NS, "pic:cNvPr");
  cNvPr.setAttribute("id", "1");
  cNvPr.setAttribute("name", "wanora_photo.jpeg");
  const cNvPicPr = doc.createElementNS(PIC_NS, "pic:cNvPicPr");
  nvPicPr.appendChild(cNvPr);
  nvPicPr.appendChild(cNvPicPr);
  const blipFill = doc.createElementNS(PIC_NS, "pic:blipFill");
  const blip = doc.createElementNS(A_NS, "a:blip");
  blip.setAttributeNS(R_NS, "r:embed", PHOTO_REL_ID);
  const stretch = doc.createElementNS(A_NS, "a:stretch");
  const fillRect = doc.createElementNS(A_NS, "a:fillRect");
  stretch.appendChild(fillRect);
  blipFill.appendChild(blip);
  blipFill.appendChild(stretch);
  const spPr = doc.createElementNS(PIC_NS, "pic:spPr");
  const xfrm = doc.createElementNS(A_NS, "a:xfrm");
  const off = doc.createElementNS(A_NS, "a:off");
  off.setAttribute("x", "0");
  off.setAttribute("y", "0");
  const ext = doc.createElementNS(A_NS, "a:ext");
  ext.setAttribute("cx", String(RIREKISHO_PHOTO_EMU.cx));
  ext.setAttribute("cy", String(RIREKISHO_PHOTO_EMU.cy));
  xfrm.appendChild(off);
  xfrm.appendChild(ext);
  const prstGeom = doc.createElementNS(A_NS, "a:prstGeom");
  prstGeom.setAttribute("prst", "rect");
  prstGeom.appendChild(doc.createElementNS(A_NS, "a:avLst"));
  spPr.appendChild(xfrm);
  spPr.appendChild(prstGeom);
  pic.appendChild(nvPicPr);
  pic.appendChild(blipFill);
  pic.appendChild(spPr);
  graphicData.appendChild(pic);
  graphic.appendChild(graphicData);

  // Update wp:docPr name
  const docPrs = anchor.getElementsByTagNameNS(WP_NS, "docPr");
  const docPr = docPrs[0] as XmlElement | undefined;
  if (docPr) {
    docPr.setAttribute("name", "証明写真");
  }

  // Drop VML Fallback (still carries 「写真を貼る位置」) so Word shows only the JPEG.
  const fallbacks = Array.from(
    doc.getElementsByTagNameNS(MC_NS, "Fallback"),
  ) as XmlElement[];
  for (const fb of fallbacks) {
    const picts = fb.getElementsByTagNameNS(W_NS, "pict");
    if (picts.length > 0 || (fb.textContent ?? "").includes("写真")) {
      fb.parentNode?.removeChild(fb);
    }
  }

  // Any leftover placeholder copy in Choice textboxes / orphaned runs.
  if (doc.documentElement) clearPhotoPlaceholderText(doc.documentElement);
}

function ensurePhotoRelationship(relsXml: string): string {
  const relsDoc = new DOMParser().parseFromString(relsXml, "application/xml");
  const root = relsDoc.documentElement;
  if (!root) throw new Error("document.xml.rels missing root");
  // Remove prior wanora photo rel if re-filling.
  const existing = Array.from(root.getElementsByTagName("Relationship"));
  for (const rel of existing) {
    if (
      rel.getAttribute("Id") === PHOTO_REL_ID ||
      rel.getAttribute("Target") === "media/wanora_photo.jpeg"
    ) {
      root.removeChild(rel);
    }
  }
  const rel = relsDoc.createElementNS(REL_NS, "Relationship");
  rel.setAttribute("Id", PHOTO_REL_ID);
  rel.setAttribute(
    "Type",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
  );
  rel.setAttribute("Target", "media/wanora_photo.jpeg");
  root.appendChild(rel);
  return new XMLSerializer().serializeToString(relsDoc);
}

function ensureJpegContentType(ctXml: string): string {
  const ctDoc = new DOMParser().parseFromString(ctXml, "application/xml");
  const root = ctDoc.documentElement;
  if (!root) throw new Error("[Content_Types].xml missing root");
  const overrides = Array.from(root.getElementsByTagName("Override"));
  for (const o of overrides) {
    if (o.getAttribute("PartName") === "/word/media/wanora_photo.jpeg") {
      root.removeChild(o);
    }
  }
  const defaults = Array.from(root.getElementsByTagName("Default"));
  const hasJpeg = defaults.some(
    (d) =>
      d.getAttribute("Extension") === "jpeg" ||
      d.getAttribute("Extension") === "jpg",
  );
  if (!hasJpeg) {
    const def = ctDoc.createElementNS(CT_NS, "Default");
    def.setAttribute("Extension", "jpeg");
    def.setAttribute("ContentType", "image/jpeg");
    root.insertBefore(def, root.firstChild);
  }
  const override = ctDoc.createElementNS(CT_NS, "Override");
  override.setAttribute("PartName", "/word/media/wanora_photo.jpeg");
  override.setAttribute("ContentType", "image/jpeg");
  root.appendChild(override);
  return new XMLSerializer().serializeToString(ctDoc);
}

function assertLayoutGuards(documentXml: string): void {
  const doc = new DOMParser().parseFromString(documentXml, "application/xml");
  const body = doc.getElementsByTagNameNS(W_NS, "body")[0] as XmlElement;
  const pgSz = doc.getElementsByTagNameNS(W_NS, "pgSz")[0] as XmlElement;
  if (
    pgSz.getAttribute("w:w") !== String(RIREKISHO_PAGE.widthTwips) ||
    pgSz.getAttribute("w:h") !== String(RIREKISHO_PAGE.heightTwips)
  ) {
    throw new Error("rirekisho layout guard: pgSz mismatch");
  }
  const pgMar = doc.getElementsByTagNameNS(W_NS, "pgMar")[0] as XmlElement;
  for (const edge of ["top", "right", "bottom", "left"] as const) {
    if (pgMar.getAttribute(`w:${edge}`) !== String(RIREKISHO_PAGE.marginTwips)) {
      throw new Error(`rirekisho layout guard: pgMar ${edge} mismatch`);
    }
  }
  const tbls = tables(body);
  if (tbls.length < 5) {
    throw new Error("rirekisho layout guard: expected ≥5 tables");
  }
  const grids = tbls.map((tbl) => {
    const grid = firstChild(tbl, "tblGrid");
    if (!grid) return [];
    return children(grid, "gridCol").map((c) => Number(c.getAttribute("w:w")));
  });
  if (grids[0]?.join() !== RIREKISHO_GRIDS.identity.join()) {
    throw new Error(`rirekisho layout guard: identity grid ${grids[0]}`);
  }
  if (grids[1]?.join() !== RIREKISHO_GRIDS.historyPage1.join()) {
    throw new Error(`rirekisho layout guard: history p1 grid ${grids[1]}`);
  }
  if (grids[2]?.join() !== RIREKISHO_GRIDS.historyPage2.join()) {
    throw new Error(`rirekisho layout guard: history p2 grid ${grids[2]}`);
  }
}

/**
 * Round-trip the blank template through JSZip without editing document.xml.
 * Used to detect packaging-side layout drift.
 */
export async function roundTripRirekishoTemplate(): Promise<Buffer> {
  const raw = loadRirekishoTemplateBytes();
  const zip = await JSZip.loadAsync(raw);
  return Buffer.from(await zip.generateAsync({ type: "uint8array" }));
}

export async function fillRirekishoDocx(
  snapshot: ExportSnapshot,
  photoPrintJpeg?: Buffer | null,
): Promise<Buffer> {
  const template = loadRirekishoTemplateBytes();
  const zip = await JSZip.loadAsync(template);
  const documentXml = await zip.file("word/document.xml")!.async("string");
  const doc = new DOMParser().parseFromString(documentXml, "application/xml");
  const body = doc.getElementsByTagNameNS(W_NS, "body")[0] as XmlElement;
  const tbls = tables(body);

  fillIdentity(tbls[0]!, doc, snapshot);

  const history = buildRirekishoHistoryLines(snapshot);
  const page1Slots = rows(tbls[1]!).slice(1); // 15 blank rows
  let remaining = fillHistorySlots(page1Slots, doc, history);

  const page2All = rows(tbls[2]!);
  const licenseIdx = page2All.findIndex((tr) =>
    /免\s*許・資\s*格|免許・資格/.test(textOf(tr)),
  );
  const page2Slots = page2All.slice(1, licenseIdx < 0 ? undefined : licenseIdx);
  remaining = fillHistorySlots(page2Slots, doc, remaining);

  fillLicenses(tbls[2]!, doc, snapshot);

  // Overflow history → continuation page(s) before 自己PR table.
  if (remaining.length > 0) {
    const selfPrTbl = tbls[3]!;
    insertPageBreakBefore(selfPrTbl, doc);
    const cont = makeContinuationTable(doc, tbls[2]!, remaining);
    selfPrTbl.parentNode!.insertBefore(cont, selfPrTbl);
  }

  // 自己PR / 本人希望
  const selfPrRows = rows(tbls[3]!);
  if (selfPrRows[1]) {
    setCellPlainText(cells(selfPrRows[1]!)[0]!, doc, snapshot.selfPr ?? "");
  }
  const hopeRows = rows(tbls[4]!);
  if (hopeRows[1]) {
    setCellPlainText(
      cells(hopeRows[1]!)[0]!,
      doc,
      snapshot.personalHope ?? "",
    );
  }

  const hasPhoto = Boolean(photoPrintJpeg?.byteLength);
  replacePhotoWithJpeg(doc, hasPhoto);

  const outXml = new XMLSerializer().serializeToString(doc);
  assertLayoutGuards(outXml);
  zip.file("word/document.xml", outXml);

  if (hasPhoto && photoPrintJpeg) {
    zip.file(PHOTO_MEDIA_PATH, photoPrintJpeg);
    const rels = await zip.file("word/_rels/document.xml.rels")!.async("string");
    zip.file("word/_rels/document.xml.rels", ensurePhotoRelationship(rels));
    const ct = await zip.file("[Content_Types].xml")!.async("string");
    zip.file("[Content_Types].xml", ensureJpegContentType(ct));
  }

  return Buffer.from(
    await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    }),
  );
}

/** Unpack helpers for tests. */
export async function readDocxEntry(
  buf: Buffer,
  path: string,
): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const f = zip.file(path);
  if (!f) throw new Error(`missing ${path}`);
  return f.async("string");
}

export async function docxHasEntry(
  buf: Buffer,
  path: string,
): Promise<boolean> {
  const zip = await JSZip.loadAsync(buf);
  return zip.file(path) != null;
}
