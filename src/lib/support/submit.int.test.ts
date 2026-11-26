import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { findSupportReportByAcceptanceNumber } from "@/lib/data/support-reports";
import { resetServerEnvCache } from "@/lib/env";
import { submitSupportReport } from "@/lib/support/submit";

beforeEach(() => {
  process.env.SUPPORT_REPORTS_ENABLED = "true";
  process.env.SUPPORT_NOTIFY_PROVIDER = "log";
  process.env.SUPPORT_REPORT_RATE_LIMIT_PER_HOUR = "50";
  process.env.SUPPORT_NOTIFY_MAX_ATTEMPTS = "3";
  resetServerEnvCache();
});

afterEach(() => {
  resetServerEnvCache();
  vi.restoreAllMocks();
});

describe("submitSupportReport", () => {
  it("persists once for the same clientSubmissionId and notifies via log", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const db = getDb();
    const clientSubmissionId = randomUUID();
    const body = {
      clientSubmissionId,
      category: "bug_report" as const,
      message: "プロジェクト保存に失敗しました",
      replyEmail: "reporter@example.test",
      diagnostic: {
        module: "my_career" as const,
        operation: "save_project",
        routeId: "profile",
        errorCode: "career_project_save_failed" as const,
        faultId: "flt_project_test",
        source: "server" as const,
      },
    };

    const first = await submitSupportReport(db, {
      body,
      userId: null,
      rateLimitKey: `ip:test-${clientSubmissionId}`,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.replayed).toBe(false);
    expect(first.acceptanceNumber.startsWith("WR-")).toBe(true);

    const second = await submitSupportReport(db, {
      body,
      userId: null,
      rateLimitKey: `ip:test-${clientSubmissionId}`,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.replayed).toBe(true);
    expect(second.acceptanceNumber).toBe(first.acceptanceNumber);

    const row = await findSupportReportByAcceptanceNumber(
      db,
      first.acceptanceNumber,
    );
    expect(row?.message).toBe(body.message);
    expect(row?.replyEmail).toBe("reporter@example.test");
    expect(row?.notifyStatus).toBe("sent");

    const notifyJson = spy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(notifyJson).toContain(first.acceptanceNumber);
    expect(notifyJson).not.toContain("プロジェクト保存に失敗しました");
    expect(notifyJson).not.toContain("reporter@example.test");
  });

  it("allows a new report with a different clientSubmissionId", async () => {
    const db = getDb();
    const a = await submitSupportReport(db, {
      body: {
        clientSubmissionId: randomUUID(),
        category: "other_inquiry",
        message: "機能について質問",
      },
      rateLimitKey: `ip:other-${randomUUID()}`,
    });
    const b = await submitSupportReport(db, {
      body: {
        clientSubmissionId: randomUUID(),
        category: "other_inquiry",
        message: "別の質問",
      },
      rateLimitKey: `ip:other-${randomUUID()}`,
    });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.acceptanceNumber).not.toBe(b.acceptanceNumber);
    }
  });
});
