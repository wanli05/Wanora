import type { BoardSlot } from "./dto";

/** Match by instant equality so +09:00 and Z forms of the same time both hit. */
export function slotMatchesInterview(
  slot: Pick<BoardSlot, "start" | "end">,
  interview: { start: string; end: string },
): boolean {
  return (
    new Date(slot.start).getTime() === new Date(interview.start).getTime() &&
    new Date(slot.end).getTime() === new Date(interview.end).getTime()
  );
}

/**
 * Initial radio selection for the confirm / reschedule drawer:
 * - with a current interview → matching candidate, else null (confirm disabled)
 * - without → null (user must pick)
 */
export function initialConfirmSlotId(
  slots: BoardSlot[],
  currentInterview?: { start: string; end: string } | null,
): string | null {
  if (!currentInterview) return null;
  const match = slots.find((slot) => slotMatchesInterview(slot, currentInterview));
  return match?.id ?? null;
}
