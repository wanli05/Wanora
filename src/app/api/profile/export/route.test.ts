import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUser = vi.fn();
const loadExportSnapshotForUser = vi.fn();
const buildExportDocx = vi.fn();
const buildExportPdf = vi.fn();

vi.mock("@/lib/session", () => ({
  getSessionUser: (...args: unknown[]) => getSessionUser(...args),
}));

vi.mock("@/db", () => ({
  getDb: () => ({}),
}));

vi.mock("@/lib/export/load-export-snapshot", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/export/load-export-snapshot")
  >("@/lib/export/load-export-snapshot");
  return {
    ...actual,
    loadExportSnapshotForUser: (...args: unknown[]) =>
      loadExportSnapshotForUser(...args),
  };
});

vi.mock("@/lib/export/build-docx", () => ({
  buildExportDocx: (...args: unknown[]) => buildExportDocx(...args),
}));

vi.mock("@/lib/export/build-pdf", () => ({
  buildExportPdf: (...args: unknown[]) => buildExportPdf(...args),
}));

describe("GET /api/profile/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUser.mockResolvedValue({ id: "user-1" });
    loadExportSnapshotForUser.mockResolvedValue({ fullName: "楊" });
    buildExportDocx.mockResolvedValue(Buffer.from("PK-docx"));
    buildExportPdf.mockResolvedValue(Buffer.from("%PDF-1.4"));
  });

  it("returns 401 when unauthenticated", async () => {
    getSessionUser.mockResolvedValue(null);
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/profile/export?doc=rirekisho&format=docx"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid query", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/profile/export?doc=nope&format=docx"),
    );
    expect(res.status).toBe(400);
  });

  it("streams a docx attachment for the session user", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new Request(
        "http://localhost/api/profile/export?doc=rirekisho&format=docx",
      ),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain(
      "application/vnd.openxmlformats",
    );
    expect(res.headers.get("Content-Disposition")).toContain(
      encodeURIComponent("履歴書.docx"),
    );
    expect(buildExportDocx).toHaveBeenCalledOnce();
    expect(buildExportPdf).not.toHaveBeenCalled();
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.toString("utf8")).toBe("PK-docx");
  });

  it("streams a pdf attachment", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new Request(
        "http://localhost/api/profile/export?doc=shokumu&format=pdf",
      ),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain(
      encodeURIComponent("職務経歴書.pdf"),
    );
    expect(buildExportPdf).toHaveBeenCalledOnce();
  });
});
