import { describe, expect, it } from "vitest";
import { isJobTerminal, jobStatusLabel } from "./job-status-label";

const t = (
  key:
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
    | "statusFailed",
) => `msg:${key}`;

describe("jobStatusLabel", () => {
  it("maps statuses through translation keys", () => {
    expect(jobStatusLabel({ status: "queued", errorCode: null }, t)).toBe(
      "msg:statusQueued",
    );
    expect(jobStatusLabel({ status: "running", errorCode: null }, t)).toBe(
      "msg:statusRunning",
    );
    expect(
      jobStatusLabel({ status: "failed", errorCode: "provider_uncertain" }, t),
    ).toBe("msg:statusUncertain");
    expect(
      jobStatusLabel({ status: "failed", errorCode: "usage_unknown" }, t),
    ).toBe("msg:statusUncertain");
    expect(
      jobStatusLabel(
        { status: "failed", errorCode: "global_budget_exceeded" },
        t,
      ),
    ).toBe("msg:statusGlobalBudget");
    expect(
      jobStatusLabel({ status: "failed", errorCode: "daily_limit_exceeded" }, t),
    ).toBe("msg:statusDailyLimit");
  });

  it("detects terminal statuses", () => {
    expect(isJobTerminal("succeeded")).toBe(true);
    expect(isJobTerminal("running")).toBe(false);
  });
});
