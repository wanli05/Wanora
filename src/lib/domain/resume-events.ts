import type { Locale } from "@/lib/locale";

export const EDUCATION_EVENT_CODES = [
  "enrolled",
  "graduated",
  "withdrawn",
  "completed",
] as const;
export type EducationEventCode = (typeof EDUCATION_EVENT_CODES)[number];

export const WORK_HISTORY_EVENT_CODES = [
  "joined",
  "left",
  "transferred",
] as const;
export type WorkHistoryEventCode = (typeof WORK_HISTORY_EVENT_CODES)[number];

export const LICENSE_STATUSES = ["acquired", "expected"] as const;
export type LicenseStatus = (typeof LICENSE_STATUSES)[number];

export type TimelineRow = {
  yearMonth: Date;
  sortOrder: number;
};

/** Chronological order for 履歴書 学歴・職歴 rows. */
export function compareTimelineRows(a: TimelineRow, b: TimelineRow): number {
  const ta = a.yearMonth.getTime();
  const tb = b.yearMonth.getTime();
  if (ta !== tb) return ta - tb;
  return a.sortOrder - b.sortOrder;
}

/** Closing line rules per export locale (MVP manual export preview helpers). */
export function resumeSectionClosingPhrase(locale: Locale): string | null {
  if (locale === "ja") return "以上";
  return null;
}

export function employedUntilPhrase(locale: Locale): string {
  switch (locale) {
    case "ja":
      return "現在に至る";
    case "zh-CN":
      return "至今";
    default:
      return "Present";
  }
}
