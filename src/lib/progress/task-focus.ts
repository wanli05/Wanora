import { INTERVIEW_STAGE_KINDS } from "./enums";
import type { BoardApplication, BoardStageInterview } from "./dto";
import { isClosed } from "./stages";

export type TaskFocus = "interview" | "waiting" | "overdue";

/** Kept for conflict badge / book-time checks; not shown in summary stats. */
export type AppTaskFlags = {
  interview: boolean;
  waiting: boolean;
  overdue: boolean;
  overlap: boolean;
};

export type TaskDetailKind =
  | "upcoming_interview"
  | "awaiting_slot_reply"
  | "awaiting_feedback"
  | "awaiting_schedule"
  | "overdue_stage";

export type TaskDetailAction =
  | { type: "open_confirm"; appId: string }
  | { type: "open_edit_slots"; appId: string }
  | { type: "open_app_detail"; appId: string; section?: "basic" | "history" }
  | { type: "open_feedback"; appId: string; interviewId: string };

export type TaskDetailItem = {
  id: string;
  appId: string;
  company: string;
  kind: TaskDetailKind;
  /** i18n message key under Board */
  messageKey: string;
  messageValues?: Record<string, string | number>;
  severity: "info" | "warning";
  action: TaskDetailAction;
  actionLabelKey: string;
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
      app.proposal?.status !== "draft") ||
    hasFeedbackPending(app, nowMs);
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

function hasFeedbackPending(app: BoardApplication, nowMs: number): boolean {
  return app.stageInterviews.some(
    (iv) =>
      iv.canWriteFeedback &&
      iv.feedbacks.length === 0 &&
      new Date(iv.start).getTime() <= nowMs,
  );
}

export function countTaskFocus(
  apps: BoardApplication[],
  nowMs: number,
): Record<TaskFocus, number> {
  const counts: Record<TaskFocus, number> = {
    interview: 0,
    waiting: 0,
    overdue: 0,
  };
  for (const app of apps) {
    const flags = appTaskFlags(app, nowMs);
    if (flags.interview) counts.interview += 1;
    if (flags.waiting) counts.waiting += 1;
    if (flags.overdue) counts.overdue += 1;
  }
  return counts;
}

export function listTaskDetails(
  apps: BoardApplication[],
  nowMs: number,
  focus: TaskFocus | null,
): TaskDetailItem[] {
  const open = apps.filter((app) => !isClosed(app.outcome, app.offerDecision));
  const items: TaskDetailItem[] = [];
  for (const app of open) {
    const flags = appTaskFlags(app, nowMs);
    if ((!focus || focus === "interview") && flags.interview && app.interview) {
      items.push({
        id: `${app.id}-interview`,
        appId: app.id,
        company: app.company,
        kind: "upcoming_interview",
        messageKey: "taskDetailUpcomingInterview",
        severity: "info",
        action: { type: "open_app_detail", appId: app.id, section: "history" },
        actionLabelKey: "taskDetailActionDetail",
      });
    }
    if (!focus || focus === "waiting") {
      if (app.proposal?.status === "sent" && !app.interview) {
        items.push({
          id: `${app.id}-slot-reply`,
          appId: app.id,
          company: app.company,
          kind: "awaiting_slot_reply",
          messageKey: "taskDetailAwaitingSlotReply",
          severity: "info",
          action: { type: "open_confirm", appId: app.id },
          actionLabelKey: "taskDetailActionConfirmSchedule",
        });
      }
      const feedbackIv = firstFeedbackPending(app, nowMs);
      if (feedbackIv) {
        items.push({
          id: `${app.id}-feedback-${feedbackIv.id}`,
          appId: app.id,
          company: app.company,
          kind: "awaiting_feedback",
          messageKey: "taskDetailAwaitingFeedback",
          severity: "warning",
          action: {
            type: "open_feedback",
            appId: app.id,
            interviewId: feedbackIv.id,
          },
          actionLabelKey: "taskDetailActionFeedback",
        });
      } else if (
        flags.waiting &&
        app.proposal?.status !== "sent" &&
        !app.interview &&
        !hasFeedbackPending(app, nowMs)
      ) {
        items.push({
          id: `${app.id}-schedule`,
          appId: app.id,
          company: app.company,
          kind: "awaiting_schedule",
          messageKey: "taskDetailAwaitingSchedule",
          severity: "info",
          action: { type: "open_edit_slots", appId: app.id },
          actionLabelKey: "taskDetailActionEditSlots",
        });
      }
    }
    if ((!focus || focus === "overdue") && flags.overdue) {
      items.push({
        id: `${app.id}-overdue`,
        appId: app.id,
        company: app.company,
        kind: "overdue_stage",
        messageKey: "taskDetailOverdue",
        severity: "warning",
        action: { type: "open_app_detail", appId: app.id, section: "basic" },
        actionLabelKey: "taskDetailActionDetail",
      });
    }
  }
  return items;
}

function firstFeedbackPending(
  app: BoardApplication,
  nowMs: number,
): BoardStageInterview | undefined {
  return app.stageInterviews.find(
    (iv) =>
      iv.canWriteFeedback &&
      iv.feedbacks.length === 0 &&
      new Date(iv.start).getTime() <= nowMs,
  );
}

/** Prefer an app that finished an interview but still has no feedback. */
export function feedbackPendingAlert(
  apps: BoardApplication[],
  nowMs: number,
): BoardApplication | null {
  const open = apps.filter((app) => !isClosed(app.outcome, app.offerDecision));
  for (const app of open) {
    if (firstFeedbackPending(app, nowMs)) return app;
  }
  return open.find((app) => appTaskFlags(app, nowMs).interview) ?? null;
}
