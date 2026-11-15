import type { AiJobDto } from "@/lib/ai/jobs";

/** Map authoritative job status to AiSidebar Japanese copy via t(). */
export function jobStatusLabel(
  job: Pick<AiJobDto, "status" | "errorCode">,
  t: (key: "statusQueued" | "statusRunning" | "statusSucceeded" | "statusCanceled" | "statusCanceledDeleted" | "statusUncertain" | "statusBudget" | "statusRate" | "statusFailed") => string,
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
        job.errorCode === "uncertain_reconciled"
      ) {
        return t("statusUncertain");
      }
      if (job.errorCode === "budget_exceeded") return t("statusBudget");
      if (job.errorCode === "rate_limited") return t("statusRate");
      return t("statusFailed");
    default:
      return job.status;
  }
}

export function isJobTerminal(status: string): boolean {
  return status === "succeeded" || status === "failed" || status === "canceled";
}
