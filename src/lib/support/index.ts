export {
  SUPPORT_CATEGORIES,
  SUPPORT_ERROR_CODES,
  SUPPORT_MODULES,
  submitSupportReportBodySchema,
  supportDiagnosticSchema,
  type ReportIssueContext,
  type SubmitSupportReportBody,
  type SupportCategory,
  type SupportDiagnostic,
  type SupportErrorCode,
  type SupportModule,
} from "@/lib/support/types";
export { createFaultId, logServerFault } from "@/lib/support/fault";
export { generateAcceptanceNumber } from "@/lib/support/acceptance-number";
export {
  buildSupportNotifyPayload,
  sendSupportMaintainerNotify,
} from "@/lib/support/notify";
export { supportRateLimitKey } from "@/lib/support/rate-limit-key";
export {
  createClientSubmissionId,
  isUuidString,
} from "@/lib/support/client-submission-id";
export { detectBrowserInfo } from "@/lib/support/browser-info";
export {
  retrySupportNotify,
  submitSupportReport,
  type SubmitSupportReportResult,
} from "@/lib/support/submit";
