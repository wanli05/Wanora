import { getDb } from "@/db";
import { buildExportDocx } from "@/lib/export/build-docx";
import { buildExportPdf } from "@/lib/export/build-pdf";
import {
  exportFilename,
  loadExportSnapshotForUser,
  type ExportDocKind,
  type ExportFormat,
} from "@/lib/export/load-export-snapshot";
import { getSessionUser } from "@/lib/session";

function parseDoc(raw: string | null): ExportDocKind | null {
  if (raw === "rirekisho" || raw === "shokumu") return raw;
  return null;
}

function parseFormat(raw: string | null): ExportFormat | null {
  if (raw === "docx" || raw === "pdf") return raw;
  return null;
}

export async function GET(request: Request) {
  const user = await getSessionUser(request.headers);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const doc = parseDoc(url.searchParams.get("doc"));
  const format = parseFormat(url.searchParams.get("format"));
  if (!doc || !format) {
    return Response.json(
      { error: "invalid_query", hint: "doc=rirekisho|shokumu&format=docx|pdf" },
      { status: 400 },
    );
  }

  const snapshot = await loadExportSnapshotForUser(getDb(), user.id);
  const body =
    format === "docx"
      ? await buildExportDocx(snapshot, doc)
      : await buildExportPdf(snapshot, doc);

  const filename = exportFilename(doc, format);
  const contentType =
    format === "docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/pdf";

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
