import {
  STAGE_KINDS,
  type Application,
  type ConflictHit,
  type Interview,
  type ProposedSlot,
  type SlotConflict,
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

export function tokyoDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TOKYO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function rawOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return new Date(aStart).getTime() < new Date(bEnd).getTime() &&
    new Date(bStart).getTime() < new Date(aEnd).getTime();
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

export function stageSlots(stage: Stage | undefined): ProposedSlot[] {
  return stage?.proposedSlots ?? [];
}

export function allProposedSlots(apps: Application[]) {
  return apps.flatMap((app) =>
    app.stages.flatMap((stage) =>
      stageSlots(stage).map((slot) => ({ app, stage, slot })),
    ),
  );
}

export function occupiedWindows(apps: Application[]) {
  const confirmed = scheduledInterviews(apps).map((item) => ({
    kind: "confirmed" as const,
    company: item.app.company,
    start: item.interview.start,
    end: item.interview.end,
  }));
  const proposed = allProposedSlots(apps).map((item) => ({
    kind: "proposed" as const,
    company: item.app.company,
    start: item.slot.start,
    end: item.slot.end,
  }));
  return [...confirmed, ...proposed].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );
}

export function detectSlotConflict(
  apps: Application[],
  startIso: string,
  endIso: string,
  options: { ignoreAppId?: string; ignoreSlotId?: string } = {},
): SlotConflict | null {
  const confirmed = detectHardConflict(apps, startIso, endIso);
  if (confirmed) {
    const match = scheduledInterviews(apps).find(
      (item) =>
        item.app.company === confirmed.otherCompany &&
        item.interview.start === confirmed.otherStart,
    );
    return {
      kind: "confirmed",
      otherCompany: confirmed.otherCompany,
      otherStart: confirmed.otherStart,
      otherEnd: match?.interview.end ?? confirmed.otherStart,
    };
  }
  for (const item of allProposedSlots(apps)) {
    if (item.app.id === options.ignoreAppId) continue;
    if (item.slot.id === options.ignoreSlotId) continue;
    if (rawOverlap(startIso, endIso, item.slot.start, item.slot.end)) {
      return {
        kind: "proposed",
        otherCompany: item.app.company,
        otherStart: item.slot.start,
        otherEnd: item.slot.end,
      };
    }
  }
  return null;
}

export function detectOwnSlotOverlap(
  existing: ProposedSlot[],
  startIso: string,
  endIso: string,
  ignoreSlotId?: string,
): boolean {
  return existing.some(
    (slot) =>
      slot.id !== ignoreSlotId && rawOverlap(startIso, endIso, slot.start, slot.end),
  );
}

export function addProposedSlots(
  app: Application,
  slots: ProposedSlot[],
): Application {
  const stage = currentStage(app);
  if (!stage) return app;
  return {
    ...app,
    stages: app.stages.map((item) =>
      item.id === stage.id
        ? { ...item, proposedSlots: [...stageSlots(item), ...slots] }
        : item,
    ),
  };
}

export function confirmProposedSlot(app: Application, slotId: string): Application {
  const stage = currentStage(app);
  const slot = stageSlots(stage).find((item) => item.id === slotId);
  if (!stage || !slot) return app;
  const interview: Interview = {
    id: `iv-from-${slot.id}`,
    start: slot.start,
    end: slot.end,
    mode: "google_meet",
    status: "scheduled",
  };
  return {
    ...app,
    stages: app.stages.map((item) =>
      item.id === stage.id
        ? {
            ...item,
            status: "scheduled",
            interviews: [...item.interviews, interview],
            proposedSlots: stageSlots(item).filter((entry) => entry.id !== slotId),
          }
        : item,
    ),
  };
}

export type MonthCell = {
  key: string;
  inMonth: boolean;
  day: number;
};

export function monthCells(year: number, monthIndex: number): MonthCell[] {
  const pad = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01T12:00:00+09:00`;
  const start = new Date(pad);
  const mondayOffset = (start.getUTCDay() + 6) % 7;
  const cursor = new Date(start);
  cursor.setUTCDate(cursor.getUTCDate() - mondayOffset);
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const total = Math.ceil((mondayOffset + daysInMonth) / 7) * 7;
  const cells: MonthCell[] = [];
  for (let i = 0; i < total; i += 1) {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth();
    const d = cursor.getUTCDate();
    cells.push({
      key: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      inMonth: y === year && m === monthIndex,
      day: d,
    });
    cursor.setUTCDate(d + 1);
  }
  return cells;
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
