import { describe, expect, it } from "vitest";
import { exportFilename } from "@/lib/export/load-export-snapshot";

describe("exportFilename", () => {
  it("uses Japanese base names with format extension", () => {
    expect(exportFilename("rirekisho", "docx")).toBe("履歴書.docx");
    expect(exportFilename("rirekisho", "pdf")).toBe("履歴書.pdf");
    expect(exportFilename("shokumu", "docx")).toBe("職務経歴書.docx");
    expect(exportFilename("shokumu", "pdf")).toBe("職務経歴書.pdf");
  });
});
