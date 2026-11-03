/** Rirekisho-style display helpers for profile timeline tables. */

import { formatYearMonthJa } from "@/lib/domain/dates";

export function formatWorkHistoryYearMonthEvent(
  year: number,
  month: number,
  eventLabel: string,
): string {
  return `${formatYearMonthJa(year, month)} ${eventLabel}`;
}

export { formatYearMonthJa };

export function localizedJa(text: { ja?: string; en?: string; "zh-CN"?: string } | null | undefined): string {
  if (!text) return "";
  return text.ja ?? text.en ?? text["zh-CN"] ?? "";
}
