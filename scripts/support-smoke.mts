import { randomUUID } from "node:crypto";
import { getDb } from "../src/db";
import { findSupportReportByAcceptanceNumber } from "../src/lib/data/support-reports";
import { logServerFault } from "../src/lib/support/fault";
import { resetServerEnvCache } from "../src/lib/env";
import {
  retrySupportNotify,
  submitSupportReport,
} from "../src/lib/support/submit";

resetServerEnvCache();
const db = getDb();
const faultId = logServerFault({
  errorCode: "career_project_save_failed",
  module: "my_career",
  operation: "save_project",
  reason: "smoke",
});
const clientSubmissionId = randomUUID();
const body = {
  clientSubmissionId,
  category: "bug_report" as const,
  message: "スモーク：プロジェクト保存失敗",
  replyEmail: "smoke@example.test",
  diagnostic: {
    module: "my_career" as const,
    operation: "save_project",
    routeId: "profile",
    errorCode: "career_project_save_failed" as const,
    faultId,
    source: "server" as const,
  },
};

const first = await submitSupportReport(db, {
  body,
  rateLimitKey: `smoke:${clientSubmissionId}`,
});
console.log("first", first);
const second = await submitSupportReport(db, {
  body,
  rateLimitKey: `smoke:${clientSubmissionId}`,
});
console.log("second", second);
if (!first.ok) process.exit(1);
const row = await findSupportReportByAcceptanceNumber(
  db,
  first.acceptanceNumber,
);
console.log("lookup", {
  acceptanceNumber: row?.acceptanceNumber,
  notifyStatus: row?.notifyStatus,
  faultId: (row?.diagnostic as { faultId?: string })?.faultId,
  messageLen: row?.message.length,
});
await retrySupportNotify(db, first.acceptanceNumber);
console.log("IDs_EXAMPLE", {
  errorCode: "career_project_save_failed",
  faultId,
  acceptanceNumber: first.acceptanceNumber,
});
