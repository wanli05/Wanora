import {
  STAGE_KINDS,
  type Application,
  type ConflictHit,
  type Interview,
  type Stage,
} from "./types";

export const TOKYO = "Asia/Tokyo";
const ONLINE_BUFFER_MS = 15 * 60 * 1000;

const DEFAULT_NEXT_PREP: Record<string, string> = {
  info_session: "説明会の準備",
  document_screening: "書類の準備・提出",
  aptitude_test: "適性検査の準備",
  interview_1: "一次面接の準備",
  interview_2: "二次面接の準備",
  interview_final: "最終面接の準備",
  offer: "内定条件の確認",
};

export function formatTokyoShort(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TOKYO,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("month")}/${get("day")} ${get("hour")}:${get("minute")}`;
}

export function formatTokyoDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TOKYO,
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("month")}/${get("day")}`;
}

export function toTokyoInputValue(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TOKYO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(iso))
    .replace(" ", "T");
}

export function fromTokyoInputValue(value: string): string {
  return new Date(`${value}:00+09:00`).toISOString();
}

export function currentStage(app: Application): Stage | undefined {
  if (app.outcome !== "in_progress" && app.outcome !== "offer") {
    return app.stages.find((stage) => stage.status === "failed");
  }
  if (app.outcome === "offer" && app.offerDecision !== "accepted") {
    return app.stages.find((stage) => stage.kind === "offer");
  }
  return app.stages.find(
    (stage) => stage.status === "pending" || stage.status === "scheduled",
  );
}

export function isClosed(app: Application): boolean {
  if (app.outcome === "rejected" || app.outcome === "withdrawn") return true;
  return app.outcome === "offer" && app.offerDecision !== "pending";
}

export function nextPrepLine(app: Application, now = new Date()): string {
  if (app.nextPrepNote) return app.nextPrepNote;
  const stage = currentStage(app);
  if (!stage) return "";

  const upcoming = stage.interviews.find(
    (interview) =>
      interview.status === "scheduled" && new Date(interview.start) > now,
  );
  if (upcoming) {
    const label = stage.customName ?? DEFAULT_NEXT_PREP[stage.kind] ?? "";
    const kindName = label.replace("の準備", "");
    const mode =
      upcoming.mode === "google_meet"
        ? "Google Meet"
        : upcoming.mode === "teams"
          ? "Microsoft Teams"
          : "";
    return `${kindName}の準備（${formatTokyoShort(upcoming.start)}${mode ? ` ${mode}` : ""}）`;
  }

  if (stage.kind === "offer") {
    return stage.deadline
      ? `内定への回答（期限 ${formatTokyoDate(stage.deadline)}）`
      : "内定への回答";
  }

  if (stage.deadline) {
    if (stage.kind === "aptitude_test") {
      return `適性検査を受ける（期限 ${formatTokyoDate(stage.deadline)}）`;
    }
    return `${DEFAULT_NEXT_PREP[stage.kind]}（期限 ${formatTokyoDate(stage.deadline)}）`;
  }

  if (stage.customName) {
    return `${stage.customName}の準備`;
  }
  return DEFAULT_NEXT_PREP[stage.kind] ?? "";
}

export function currentInterview(app: Application) {
  const stage = currentStage(app);
  return stage?.interviews.find((interview) => interview.status === "scheduled");
}

export function scheduledInterviews(apps: Application[]) {
  return apps.flatMap((app) =>
    app.stages.flatMap((stage) =>
      stage.interviews
        .filter((interview) => interview.status === "scheduled")
        .map((interview) => ({ app, stage, interview })),
    ),
  );
}

function bufferedRange(startIso: string, endIso: string) {
  return {
    start: new Date(startIso).getTime() - ONLINE_BUFFER_MS,
    end: new Date(endIso).getTime() + ONLINE_BUFFER_MS,
  };
}

export function detectHardConflict(
  apps: Application[],
  startIso: string,
  endIso: string,
  ignoreInterviewId?: string,
): ConflictHit | null {
  const candidate = bufferedRange(startIso, endIso);
  for (const item of scheduledInterviews(apps)) {
    if (item.interview.id === ignoreInterviewId) continue;
    const other = bufferedRange(item.interview.start, item.interview.end);
    if (candidate.start < other.end && other.start < candidate.end) {
      return {
        otherCompany: item.app.company,
        otherStart: item.interview.start,
      };
    }
  }
  return null;
}

export function applicationHasConflict(app: Application, apps: Application[]) {
  const interview = currentInterview(app);
  if (!interview) return false;
  return Boolean(
    detectHardConflict(apps, interview.start, interview.end, interview.id),
  );
}

export function passCurrentStage(app: Application): Application {
  const stage = currentStage(app);
  if (!stage) return app;
  const stages = app.stages.map((item) =>
    item.id === stage.id ? { ...item, status: "passed" as const } : item,
  );
  const next = stages.find(
    (item) => item.status === "pending" || item.status === "scheduled",
  );
  if (!next) {
    return {
      ...app,
      stages: stages.map((item) =>
        item.kind === "offer" ? { ...item, status: "pending" } : item,
      ),
      outcome: "offer",
      offerDecision: "pending",
    };
  }
  if (next.kind === "offer") {
    return { ...app, stages, outcome: "offer", offerDecision: "pending" };
  }
  return { ...app, stages };
}

export function addInterviewToCurrent(
  app: Application,
  interview: Interview,
): Application {
  const stage = currentStage(app);
  if (!stage) return app;
  return {
    ...app,
    stages: app.stages.map((item) =>
      item.id === stage.id
        ? {
            ...item,
            status: "scheduled",
            interviews: [...item.interviews, interview],
          }
        : item,
    ),
  };
}

export function rejectCurrent(app: Application): Application {
  const stage = currentStage(app);
  return {
    ...app,
    outcome: "rejected",
    stages: app.stages.map((item) =>
      item.id === stage?.id ? { ...item, status: "failed" as const } : item,
    ),
  };
}

export function midCareerStages(
  prefix: string,
  overrides: Partial<Record<string, Stage>> = {},
): Stage[] {
  return STAGE_KINDS.map((kind) => {
    const skipped = kind === "info_session" || kind === "interview_2";
    const base: Stage = {
      id: `${prefix}-${kind}`,
      kind,
      status: skipped ? "skipped" : "pending",
      interviews: [],
    };
    return { ...base, ...overrides[kind], id: `${prefix}-${kind}`, kind };
  });
}
