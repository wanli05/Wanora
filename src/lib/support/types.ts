import { z } from "zod";

/** Stable business failure category (not a single incident). */
export const SUPPORT_ERROR_CODES = [
  "auth_sign_in_failed",
  "auth_sign_up_failed",
  "career_profile_save_failed",
  "career_employer_save_failed",
  "career_project_save_failed",
  "career_skill_save_failed",
  "career_goal_save_failed",
  "profile_save_failed",
  "board_application_create_failed",
  "board_application_update_failed",
  "board_stage_advance_failed",
  "board_generic_failed",
  "ai_job_enqueue_failed",
  "ai_job_execute_failed",
  "export_document_failed",
  "client_observed",
  "unknown",
] as const;

export type SupportErrorCode = (typeof SUPPORT_ERROR_CODES)[number];

export const SUPPORT_MODULES = [
  "auth",
  "my_career",
  "board",
  "ai",
  "export",
  "general",
] as const;

export type SupportModule = (typeof SUPPORT_MODULES)[number];

export const SUPPORT_CATEGORIES = ["bug_report", "other_inquiry"] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

/**
 * Whitelisted diagnostic fields only.
 * Never include resume body, AI chat, request body, cookies, tokens, full URL query.
 */
export const supportDiagnosticSchema = z
  .object({
    module: z.enum(SUPPORT_MODULES),
    operation: z.string().trim().min(1).max(64),
    /** Stable route id, e.g. "profile", "board", "sign-in" — not a full URL. */
    routeId: z.string().trim().min(1).max(64),
    occurredAt: z.string().datetime().optional(),
    errorCode: z.enum(SUPPORT_ERROR_CODES).optional(),
    /** Incident id: server fault id, AI job id, or client_request_id. */
    faultId: z.string().trim().min(1).max(128).optional(),
    appVersion: z.string().trim().min(1).max(32).optional(),
    /** Best-effort browser name (whitelist; never raw UA string). */
    browserName: z.string().trim().min(1).max(32).optional(),
    browserVersion: z.string().trim().min(1).max(32).optional(),
    /** How the diagnostic was obtained. */
    source: z.enum(["server", "client_observed", "manual"]).default("manual"),
  })
  .strict();

export type SupportDiagnostic = z.infer<typeof supportDiagnosticSchema>;

export const submitSupportReportBodySchema = z
  .object({
    clientSubmissionId: z.string().uuid(),
    category: z.enum(SUPPORT_CATEGORIES),
    message: z.string().trim().min(1).max(4_000),
    replyEmail: z
      .string()
      .trim()
      .email()
      .max(254)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    diagnostic: supportDiagnosticSchema.optional(),
  })
  .strict();

export type SubmitSupportReportBody = z.infer<
  typeof submitSupportReportBodySchema
>;

/** Context passed from error UI into the report dialog (client-safe whitelist). */
export type ReportIssueContext = {
  module: SupportModule;
  operation: string;
  routeId: string;
  errorCode?: SupportErrorCode;
  faultId?: string;
  source?: SupportDiagnostic["source"];
};
