import { chromium } from "playwright";
import type { ExportSnapshot } from "@/lib/domain/export-snapshot";
import { buildExportHtml } from "@/lib/export/build-export-html";
import type { ExportDocKind } from "@/lib/export/load-export-snapshot";

/** Render locked-layout HTML to A4 PDF via headless Chromium (mvp-plan). */
export async function buildExportPdf(
  snapshot: ExportSnapshot,
  doc: ExportDocKind,
): Promise<Buffer> {
  const html = buildExportHtml(snapshot, doc);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
