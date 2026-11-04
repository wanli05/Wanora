import { bufferMsForMode, type InterviewMode } from "./enums";

export type OccupancyKind = "confirmed" | "proposed" | "busy" | "own";

export type OccupancyWindow = {
  id: string;
  kind: OccupancyKind;
  company: string;
  start: string;
  end: string;
  mode?: InterviewMode;
  applicationId?: string;
};

export type ConflictHit = {
  kind: OccupancyKind;
  otherCompany: string;
  otherStart: string;
  otherEnd: string;
  windowId: string;
};

export function rawOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return (
    new Date(aStart).getTime() < new Date(bEnd).getTime() &&
    new Date(bStart).getTime() < new Date(aEnd).getTime()
  );
}

function bufferedMs(start: string, end: string, bufferMs: number) {
  return {
    start: new Date(start).getTime() - bufferMs,
    end: new Date(end).getTime() + bufferMs,
  };
}

function overlapsMs(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function detectConflicts(
  windows: OccupancyWindow[],
  start: string,
  end: string,
  options: {
    ignoreIds?: ReadonlySet<string>;
    ignoreApplicationId?: string;
    candidateBufferMs?: number;
    against: OccupancyKind[];
  },
): ConflictHit | null {
  const ignore = options.ignoreIds ?? new Set();
  const candidate = bufferedMs(start, end, options.candidateBufferMs ?? 0);
  for (const window of windows) {
    if (!options.against.includes(window.kind)) continue;
    if (ignore.has(window.id)) continue;
    if (
      options.ignoreApplicationId &&
      window.kind === "proposed" &&
      window.applicationId === options.ignoreApplicationId
    ) {
      continue;
    }
    const otherBuffer =
      window.kind === "confirmed" || window.kind === "busy"
        ? bufferMsForMode(window.mode ?? "google_meet")
        : 0;
    const other = bufferedMs(window.start, window.end, otherBuffer);
    if (overlapsMs(candidate.start, candidate.end, other.start, other.end)) {
      return {
        kind: window.kind,
        otherCompany: window.company,
        otherStart: window.start,
        otherEnd: window.end,
        windowId: window.id,
      };
    }
  }
  return null;
}

export function detectHardInterviewConflict(
  windows: OccupancyWindow[],
  start: string,
  end: string,
  mode: InterviewMode,
  ignoreIds?: ReadonlySet<string>,
): ConflictHit | null {
  return detectConflicts(windows, start, end, {
    ignoreIds,
    candidateBufferMs: bufferMsForMode(mode),
    against: ["confirmed", "busy"],
  });
}

export function detectSlotPickConflict(
  windows: OccupancyWindow[],
  start: string,
  end: string,
  ignoreApplicationId?: string,
  ignoreIds?: ReadonlySet<string>,
): ConflictHit | null {
  return detectConflicts(windows, start, end, {
    ignoreIds,
    ignoreApplicationId,
    candidateBufferMs: 0,
    against: ["confirmed", "proposed", "busy", "own"],
  });
}

export function sameTokyoDayCount(
  windows: OccupancyWindow[],
  start: string,
  extraStart?: string,
): number {
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(start));
  const confirmed = windows.filter((window) => {
    if (window.kind !== "confirmed") return false;
    return (
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(window.start)) === key
    );
  }).length;
  if (!extraStart) return confirmed;
  const extraKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(extraStart));
  return extraKey === key ? confirmed + 1 : confirmed;
}
