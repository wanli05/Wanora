import { describe, expect, it } from "vitest";
import type { BoardSlot } from "./dto";
import {
  initialConfirmSlotId,
  slotMatchesInterview,
} from "./confirm-slot-selection";

function slot(
  id: string,
  start: string,
  end: string,
): BoardSlot {
  return { id, start, end, status: "proposed" };
}

describe("confirm-slot-selection", () => {
  const slots = [
    slot("s1", "2026-11-24T01:00:00.000Z", "2026-11-24T02:00:00.000Z"), // 10:00-11:00 JST
    slot("s2", "2026-11-25T01:00:00.000Z", "2026-11-25T02:00:00.000Z"),
    slot("s3", "2026-11-25T05:00:00.000Z", "2026-11-25T06:00:00.000Z"), // 14:00-15:00 JST
    slot("s4", "2026-11-27T01:00:00.000Z", "2026-11-27T02:00:00.000Z"),
  ];

  it("selects the third candidate when it matches the current interview (+09:00 form)", () => {
    const interview = {
      start: "2026-11-25T14:00:00+09:00",
      end: "2026-11-25T15:00:00+09:00",
    };
    expect(slotMatchesInterview(slots[2]!, interview)).toBe(true);
    expect(initialConfirmSlotId(slots, interview)).toBe("s3");
  });

  it("returns null when no candidate matches the current interview", () => {
    expect(
      initialConfirmSlotId(slots, {
        start: "2026-11-25T10:30:00+09:00",
        end: "2026-11-25T11:30:00+09:00",
      }),
    ).toBeNull();
  });

  it("returns null when confirming without an existing interview", () => {
    expect(initialConfirmSlotId(slots, null)).toBeNull();
    expect(initialConfirmSlotId(slots, undefined)).toBeNull();
  });
});
