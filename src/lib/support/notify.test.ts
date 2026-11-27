import { describe, expect, it } from "vitest";
import { buildSupportNotifyPayload } from "@/lib/support/notify";
import type { SupportReportRow } from "@/lib/data/support-reports";

function row(partial: Partial<SupportReportRow>): SupportReportRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    acceptanceNumber: "WR-20261126-ABCDEF",
    clientSubmissionId: "00000000-0000-4000-8000-000000000002",
    category: "bug_report",
    message: "SECRET MESSAGE BODY",
    replyEmail: "user@example.com",
    userId: "user-1",
    diagnostic: {
      module: "my_career",
      operation: "save_project",
      routeId: "profile",
      errorCode: "career_project_save_failed",
      faultId: "flt_abc",
      appVersion: "0.1.0",
      source: "server",
    },
    notifyStatus: "pending",
    notifyAttempts: 0,
    notifyLastError: null,
    notifySentAt: null,
    rateLimitKey: "user:user-1",
    createdAt: new Date("2026-11-26T12:00:00.000Z"),
    updatedAt: new Date("2026-11-26T12:00:00.000Z"),
    ...partial,
  };
}

describe("buildSupportNotifyPayload", () => {
  it("omits message and reply email", () => {
    const payload = buildSupportNotifyPayload(row({}));
    const json = JSON.stringify(payload);
    expect(json).not.toContain("SECRET");
    expect(json).not.toContain("user@example.com");
    expect(payload.acceptanceNumber).toBe("WR-20261126-ABCDEF");
    expect(payload.faultId).toBe("flt_abc");
    expect(payload.errorCode).toBe("career_project_save_failed");
  });
});
