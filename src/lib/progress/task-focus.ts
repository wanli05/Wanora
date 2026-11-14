import { INTERVIEW_STAGE_KINDS } from "./enums";
import type { BoardApplication } from "./dto";
import { isClosed } from "./stages";

export type TaskFocus = "interview" | "waiting" | "overdue" | "overlap";

export type AppTaskFlags = {
  interview: boolean;
  waiting: boolean;
  overdue: boolean;
  overlap: boolean;
};

export function appTaskFlags(
  app: BoardApplication,
  nowMs: number,
): AppTaskFlags {
  if (isClosed(app.outcome, app.offerDecision)) {
    return { interview: false, waiting: false, overdue: false, overlap: false };
  }
  const interview =
    Boolean(app.interview) &&
    new Date(app.interview!.start).getTime() >= nowMs - 60 * 60 * 1000;
  const waiting =
    app.proposal?.status === "sent" ||
    (app.currentStageKind === "document_screening" && !app.interview) ||
    (Boolean(app.currentStageKind) &&
      INTERVIEW_STAGE_KINDS.has(app.currentStageKind!) &&
      !app.interview &&
      app.proposal?.status !== "draft");
  const overdue = app.stages.some((stage) => {
    if (!stage.deadlineAt) return false;
    if (stage.status !== "pending" && stage.status !== "scheduled") return false;
    return new Date(stage.deadlineAt).getTime() < nowMs;
  });
  return {
    interview,
    waiting,
    overdue,
    overlap: app.conflict,
  };
}

export function countTaskFocus(
  apps: BoardApplication[],
  nowMs: number,
): Record<TaskFocus, number> {
  const counts: Record<TaskFocus, number> = {
    interview: 0,
    waiting: 0,
    overdue: 0,
    overlap: 0,
  };
  for (const app of apps) {
    const flags = appTaskFlags(app, nowMs);
    if (flags.interview) counts.interview += 1;
    if (flags.waiting) counts.waiting += 1;
    if (flags.overdue) counts.overdue += 1;
    if (flags.overlap) counts.overlap += 1;
  }
  return counts;
}

/** Prefer an app that finished an interview but still has no feedback. */
export function feedbackPendingAlert(
  apps: BoardApplication[],
  nowMs: number,
): BoardApplication | null {
  const open = apps.filter((app) => !isClosed(app.outcome, app.offerDecision));
  for (const app of open) {
    const hit = app.stageInterviews.find(
      (iv) =>
        iv.canWriteFeedback &&
        iv.feedbacks.length === 0 &&
        new Date(iv.start).getTime() <= nowMs,
    );
    if (hit) return app;
  }
  return open.find((app) => appTaskFlags(app, nowMs).interview) ?? null;
}
