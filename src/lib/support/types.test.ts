import { describe, expect, it } from "vitest";
import { submitSupportReportBodySchema } from "@/lib/support/types";

describe("submitSupportReportBodySchema", () => {
  it("accepts a valid bug report", () => {
    const parsed = submitSupportReportBodySchema.safeParse({
      clientSubmissionId: "11111111-1111-4111-8111-111111111111",
      category: "bug_report",
      message: "ボタンが反応しません",
      diagnostic: {
        module: "my_career",
        operation: "save_project",
        routeId: "profile",
        errorCode: "career_project_save_failed",
        faultId: "flt_test",
        source: "server",
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unknown diagnostic keys", () => {
    const parsed = submitSupportReportBodySchema.safeParse({
      clientSubmissionId: "11111111-1111-4111-8111-111111111111",
      category: "other_inquiry",
      message: "質問です",
      diagnostic: {
        module: "general",
        operation: "manual_contact",
        routeId: "contact",
        source: "manual",
        resumeText: "should not pass",
      },
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts optional browserName/browserVersion whitelist fields", () => {
    const parsed = submitSupportReportBodySchema.safeParse({
      clientSubmissionId: "11111111-1111-4111-8111-111111111111",
      category: "bug_report",
      message: "ボタンが反応しません",
      diagnostic: {
        module: "general",
        operation: "manual_bug_report",
        routeId: "contact",
        source: "manual",
        browserName: "Chrome",
        browserVersion: "120.0.0.0",
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects non-UUID clientSubmissionId", () => {
    const parsed = submitSupportReportBodySchema.safeParse({
      clientSubmissionId: "sub_123_abc",
      category: "other_inquiry",
      message: "質問です",
    });
    expect(parsed.success).toBe(false);
  });
});
