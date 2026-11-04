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

export function slotStarts(): { hour: number; minute: number; label: string }[] {
  const starts: { hour: number; minute: number; label: string }[] = [];
  for (let hour = SLOT_HOUR_START; hour < SLOT_HOUR_END; hour += 1) {
    for (let minute = 0; minute < 60; minute += SLOT_STEP_MINUTES) {
      if (hour === SLOT_HOUR_END - 1 && minute > 0) continue;
      const endMinutes = hour * 60 + minute + 60;
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

export function cellRange(dateKey: string, hour: number, minute: number): DraftSlot {
  const start = `${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+09:00`;
  const endMs = new Date(start).getTime() + SLOT_DURATION_MS;
  return { start, end: new Date(endMs).toISOString() };
}

export function sameSlot(a: DraftSlot, b: DraftSlot): boolean {
  return a.start === b.start && a.end === b.end;
}

export function occupancyAt(
  windows: OccupancyWindow[],
  start: string,
  end: string,
  ignoreApplicationId?: string,
) {
  return detectSlotPickConflict(windows, start, end, ignoreApplicationId);
}

export function toggleDraftSlot(
  drafts: DraftSlot[],
  next: DraftSlot,
  windows: OccupancyWindow[],
  ignoreApplicationId: string,
): { drafts: DraftSlot[]; blocked?: ReturnType<typeof detectSlotPickConflict> } {
  if (drafts.some((draft) => sameSlot(draft, next))) {
    return { drafts: drafts.filter((draft) => !sameSlot(draft, next)) };
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

export function defaultFreeSlots(
  windows: OccupancyWindow[],
  ignoreApplicationId: string,
  now = new Date(),
  count = DEFAULT_SLOT_COUNT,
): DraftSlot[] {
  const monday = mondayFromNow(now);
  const days = weekDateKeys(monday);
  const picks: DraftSlot[] = [];
  const preferred = slotStarts().filter((cell) =>
    [10, 14, 16, 11, 13, 15, 9, 17].includes(cell.hour),
  );
  const rest = slotStarts().filter((cell) => !preferred.includes(cell));
  for (const cell of [...preferred, ...rest]) {
    for (const day of days) {
      const weekday = new Date(`${day}T12:00:00+09:00`).getUTCDay();
      if (weekday === 0 || weekday === 6) continue;
      const range = cellRange(day, cell.hour, cell.minute);
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
