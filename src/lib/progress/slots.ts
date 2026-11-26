import {
  DEFAULT_SLOT_COUNT,
  MAX_SLOT_COUNT,
  SLOT_DURATION_MS,
  SLOT_HOUR_END,
  SLOT_HOUR_START,
  SLOT_STEP_MINUTES,
} from "./enums";
import {
  detectSlotPickConflict,
  rawOverlap,
  type OccupancyWindow,
} from "./conflicts";
import { addDays, tokyoTodayKey, weekDateKeys } from "./tokyo";

export type DraftSlot = { start: string; end: string };

export const SLOT_CELL_MS = SLOT_STEP_MINUTES * 60 * 1000;

export function slotStarts(): { hour: number; minute: number; label: string }[] {
  const starts: { hour: number; minute: number; label: string }[] = [];
  for (let hour = SLOT_HOUR_START; hour < SLOT_HOUR_END; hour += 1) {
    for (let minute = 0; minute < 60; minute += SLOT_STEP_MINUTES) {
      const startMinutes = hour * 60 + minute;
      const endMinutes = startMinutes + SLOT_STEP_MINUTES;
      if (endMinutes > SLOT_HOUR_END * 60) continue;
      starts.push({
        hour,
        minute,
        label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      });
    }
  }
  return starts;
}

/** One 30-minute grid cell (Tokyo offset kept on both ends). */
export function cellRange(dateKey: string, hour: number, minute: number): DraftSlot {
  const startMinutes = hour * 60 + minute;
  const endMinutes = startMinutes + SLOT_STEP_MINUTES;
  const endHour = Math.floor(endMinutes / 60);
  const endMin = endMinutes % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    start: `${dateKey}T${pad(hour)}:${pad(minute)}:00+09:00`,
    end: `${dateKey}T${pad(endHour)}:${pad(endMin)}:00+09:00`,
  };
}

/** Inclusive cell indices → one continuous draft (e.g. 10:00–11:30). */
export function rangeFromCellIndices(
  dateKey: string,
  starts: { hour: number; minute: number }[],
  fromIndex: number,
  toIndex: number,
): DraftSlot | null {
  const lo = Math.min(fromIndex, toIndex);
  const hi = Math.max(fromIndex, toIndex);
  const first = starts[lo];
  const last = starts[hi];
  if (!first || !last) return null;
  const start = cellRange(dateKey, first.hour, first.minute).start;
  const end = cellRange(dateKey, last.hour, last.minute).end;
  return { start, end };
}

export function sameSlot(a: DraftSlot, b: DraftSlot): boolean {
  return a.start === b.start && a.end === b.end;
}

export function draftCoversRange(draft: DraftSlot, range: DraftSlot): boolean {
  return (
    new Date(draft.start).getTime() <= new Date(range.start).getTime() &&
    new Date(draft.end).getTime() >= new Date(range.end).getTime()
  );
}

export function draftOverlapsRange(draft: DraftSlot, range: DraftSlot): boolean {
  return rawOverlap(draft.start, draft.end, range.start, range.end);
}

export function occupancyAt(
  windows: OccupancyWindow[],
  start: string,
  end: string,
  ignoreApplicationId?: string,
) {
  return detectSlotPickConflict(windows, start, end, ignoreApplicationId);
}

function findCoveringDraft(
  drafts: DraftSlot[],
  range: DraftSlot,
): DraftSlot | undefined {
  return drafts.find((draft) => draftCoversRange(draft, range));
}

/**
 * Click a 30-min cell:
 * - if covered by a draft, punch that cell out (keep left/right remnants)
 * - else add a new 30-min draft (with conflict / max checks)
 */
export function toggleCellInDrafts(
  drafts: DraftSlot[],
  cell: DraftSlot,
  windows: OccupancyWindow[],
  ignoreApplicationId: string,
): { drafts: DraftSlot[]; blocked?: ReturnType<typeof detectSlotPickConflict> } {
  const covering = findCoveringDraft(drafts, cell);
  if (covering) {
    const next = drafts.filter((draft) => !sameSlot(draft, covering));
    const coverStart = new Date(covering.start).getTime();
    const coverEnd = new Date(covering.end).getTime();
    const cellStart = new Date(cell.start).getTime();
    const cellEnd = new Date(cell.end).getTime();
    if (cellStart > coverStart) {
      next.push({
        start: covering.start,
        end: cell.start,
      });
    }
    if (cellEnd < coverEnd) {
      next.push({
        start: cell.end,
        end: covering.end,
      });
    }
    return { drafts: next };
  }

  if (drafts.some((draft) => sameSlot(draft, cell))) {
    return { drafts: drafts.filter((draft) => !sameSlot(draft, cell)) };
  }

  return addDraftSlot(drafts, cell, windows, ignoreApplicationId);
}

/** Drag across cells → one continuous range (or toggle single cell). */
export function applyDragRange(
  drafts: DraftSlot[],
  range: DraftSlot,
  windows: OccupancyWindow[],
  ignoreApplicationId: string,
  singleCell: boolean,
): { drafts: DraftSlot[]; blocked?: ReturnType<typeof detectSlotPickConflict> } {
  if (singleCell) {
    return toggleCellInDrafts(drafts, range, windows, ignoreApplicationId);
  }
  // Replace any drafts fully inside the new range, then add the range.
  const withoutContained = drafts.filter(
    (draft) =>
      !(
        new Date(draft.start).getTime() >= new Date(range.start).getTime() &&
        new Date(draft.end).getTime() <= new Date(range.end).getTime()
      ),
  );
  return addDraftSlot(withoutContained, range, windows, ignoreApplicationId);
}

export function removeDraftSlot(
  drafts: DraftSlot[],
  target: DraftSlot,
): DraftSlot[] {
  return drafts.filter((draft) => !sameSlot(draft, target));
}

export function addDraftSlot(
  drafts: DraftSlot[],
  next: DraftSlot,
  windows: OccupancyWindow[],
  ignoreApplicationId: string,
): { drafts: DraftSlot[]; blocked?: ReturnType<typeof detectSlotPickConflict> } {
  if (drafts.some((draft) => sameSlot(draft, next))) {
    return { drafts };
  }
  const ownWindows: OccupancyWindow[] = drafts.map((draft, index) => ({
    id: `draft-${index}`,
    kind: "own",
    company: "",
    start: draft.start,
    end: draft.end,
    applicationId: ignoreApplicationId,
  }));
  const blocked = detectSlotPickConflict(
    [...windows, ...ownWindows],
    next.start,
    next.end,
    ignoreApplicationId,
  );
  if (blocked) return { drafts, blocked };
  if (drafts.length >= MAX_SLOT_COUNT) return { drafts };
  return { drafts: [...drafts, next] };
}

/** @deprecated Prefer toggleCellInDrafts / applyDragRange for the week grid. */
export function toggleDraftSlot(
  drafts: DraftSlot[],
  next: DraftSlot,
  windows: OccupancyWindow[],
  ignoreApplicationId: string,
): { drafts: DraftSlot[]; blocked?: ReturnType<typeof detectSlotPickConflict> } {
  if (drafts.some((draft) => sameSlot(draft, next))) {
    return { drafts: drafts.filter((draft) => !sameSlot(draft, next)) };
  }
  return addDraftSlot(drafts, next, windows, ignoreApplicationId);
}

export function defaultFreeSlots(
  windows: OccupancyWindow[],
  ignoreApplicationId: string,
  now = new Date(),
  count = DEFAULT_SLOT_COUNT,
): DraftSlot[] {
  const monday = mondayFromNow(now);
  const days = weekDateKeys(monday);
  const picks: DraftSlot[] = [];
  // Prefer classic 60-minute windows (two 30-min cells).
  const preferredHours = [10, 14, 16, 11, 13, 15, 9, 17];
  for (const hour of preferredHours) {
    for (const day of days) {
      const weekday = new Date(`${day}T12:00:00+09:00`).getUTCDay();
      if (weekday === 0 || weekday === 6) continue;
      const start = `${day}T${String(hour).padStart(2, "0")}:00:00+09:00`;
      const end = new Date(new Date(start).getTime() + SLOT_DURATION_MS).toISOString();
      const range = { start, end };
      if (occupancyAt(windows, range.start, range.end, ignoreApplicationId)) {
        continue;
      }
      if (picks.some((pick) => rawOverlap(pick.start, pick.end, range.start, range.end))) {
        continue;
      }
      picks.push(range);
      if (picks.length >= count) return picks;
    }
  }
  return picks;
}

function mondayFromNow(now: Date): string {
  const today = tokyoTodayKey(now);
  const noon = new Date(`${today}T12:00:00+09:00`);
  const offset = (noon.getUTCDay() + 6) % 7;
  return addDays(today, -offset);
}
