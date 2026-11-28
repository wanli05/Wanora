import type { AiJobDto } from "@/lib/ai/jobs";

type JobStatusKey =
  | "statusQueued"
  | "statusRunning"
  | "statusSucceeded"
  | "statusCanceled"
  | "statusCanceledDeleted"
  | "statusUncertain"
  | "statusBudget"
  | "statusGlobalBudget"
  | "statusDailyLimit"
  | "statusJobInProgress"
  | "statusRate"
  | "statusFailed";

/** Map authoritative job status to AiSidebar Japanese copy via t(). */
export function jobStatusLabel(
  job: Pick<AiJobDto, "status" | "errorCode">,
  t: (key: JobStatusKey) => string,
): string {
  switch (job.status) {
    case "queued":
      return t("statusQueued");
    case "running":
      return t("statusRunning");
    case "succeeded":
      return t("statusSucceeded");
    case "canceled":
      return job.errorCode === "conversation_deleted"
        ? t("statusCanceledDeleted")
        : t("statusCanceled");
    case "failed":
      if (
        job.errorCode === "provider_uncertain" ||
        job.errorCode === "uncertain_reconciled" ||
        job.errorCode === "usage_unknown"
      ) {
        return t("statusUncertain");
      }
      if (job.errorCode === "global_budget_exceeded") {
        return t("statusGlobalBudget");
      }
      if (
        job.errorCode === "budget_exceeded" ||
        job.errorCode === "user_cost" ||
        job.errorCode === "user_token"
      ) {
        return t("statusBudget");
      }
      if (job.errorCode === "daily_limit_exceeded") {
        return t("statusDailyLimit");
      }
      if (job.errorCode === "job_in_progress") {
        return t("statusJobInProgress");
      }
      if (job.errorCode === "rate_limited") return t("statusRate");
      return t("statusFailed");
    default:
      return job.status;
  }
}

export function isJobTerminal(status: string): boolean {
  return status === "succeeded" || status === "failed" || status === "canceled";
}
