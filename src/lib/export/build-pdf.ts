import { chromium } from "playwright-core";
import type { ExportSnapshot } from "@/lib/domain/export-snapshot";
import {
  buildExportHtml,
  type ExportRenderOptions,
} from "@/lib/export/build-export-html";
import { convertDocxToPdf } from "@/lib/export/convert-docx-to-pdf";
import { fillRirekishoDocx } from "@/lib/export/fill-rirekisho-docx";
import type { ExportDocKind } from "@/lib/export/load-export-snapshot";

/**
 * Build A4 PDF.
 * - 履歴書: filled MHLW DOCX → LibreOffice PDF (same source as Word download).
 * - 職務経歴書: locked HTML → headless Chromium (unchanged path).
 */
export async function buildExportPdf(
  snapshot: ExportSnapshot,
  doc: ExportDocKind,
  options?: ExportRenderOptions,
): Promise<Buffer> {
  if (doc === "rirekisho") {
    const docx = await fillRirekishoDocx(snapshot, options?.photoPrintJpeg);
    return convertDocxToPdf(docx);
  }

  const html = buildExportHtml(snapshot, doc, options);
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
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
