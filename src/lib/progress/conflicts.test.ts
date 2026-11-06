import { describe, expect, it } from "vitest";
import {
  detectHardInterviewConflict,
  detectSlotPickConflict,
  rawOverlap,
  type OccupancyWindow,
} from "./conflicts";
import { tokyoDateKey } from "./tokyo";

const windows: OccupancyWindow[] = [
  {
    id: "mercari",
    kind: "confirmed",
    company: "株式会社メルカリ",
    start: "2026-11-12T14:00:00+09:00",
    end: "2026-11-12T15:00:00+09:00",
    mode: "google_meet",
    applicationId: "a1",
  },
  {
    id: "panasonic",
    kind: "proposed",
    company: "パナソニックホールディングス株式会社",
    start: "2026-11-14T10:00:00+09:00",
    end: "2026-11-14T11:00:00+09:00",
    applicationId: "a2",
  },
];

describe("detectConflicts", () => {
  it("treats adjacent [) ranges as not overlapping", () => {
    expect(
      rawOverlap(
        "2026-11-12T13:00:00+09:00",
        "2026-11-12T14:00:00+09:00",
        "2026-11-12T14:00:00+09:00",
        "2026-11-12T15:00:00+09:00",
      ),
    ).toBe(false);
  });

  it("blocks a confirmed interview that overlaps including buffer", () => {
    const hit = detectHardInterviewConflict(
      windows,
      "2026-11-12T15:00:00+09:00",
      "2026-11-12T16:00:00+09:00",
      "google_meet",
    );
    expect(hit?.otherCompany).toBe("株式会社メルカリ");
  });

  it("allows a confirmed interview after the buffer", () => {
    const hit = detectHardInterviewConflict(
      windows,
      "2026-11-12T15:30:00+09:00",
      "2026-11-12T16:30:00+09:00",
      "google_meet",
    );
    expect(hit).toBeNull();
  });

  it("blocks picking a slot that overlaps another company's submitted window", () => {
    const hit = detectSlotPickConflict(
      windows,
      "2026-11-14T10:30:00+09:00",
      "2026-11-14T11:30:00+09:00",
      "nttdata",
    );
    expect(hit?.kind).toBe("proposed");
    expect(hit?.otherCompany).toBe("パナソニックホールディングス株式会社");
  });

  it("does not apply buffer when comparing candidate slots", () => {
    const hit = detectSlotPickConflict(
      windows,
      "2026-11-14T11:00:00+09:00",
      "2026-11-14T12:00:00+09:00",
      "nttdata",
    );
    expect(hit).toBeNull();
  });

  it("keeps Tokyo calendar dates across UTC midnight", () => {
    expect(tokyoDateKey("2026-11-12T00:30:00+09:00")).toBe("2026-11-12");
    expect(tokyoDateKey("2026-11-11T15:30:00Z")).toBe("2026-11-12");
  });
});
