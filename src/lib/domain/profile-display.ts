/** Rirekisho-style display lines (Japanese punctuation for resume rows). */

export function formatEducationLine(
  year: number,
  month: number,
  schoolJa: string,
  eventLabel: string,
): string {
  const school = schoolJa.trim() || "—";
  return `${year}年${month}月，${school} ${eventLabel}`;
}

export function formatWorkHistoryLine(
  year: number,
  month: number,
  eventLabel: string,
): string {
  return `${year}年，${month}月，${eventLabel}`;
}

export function formatLicenseLine(
  year: number,
  month: number,
  nameJa: string,
  statusLabel: string,
): string {
  const name = nameJa.trim() || "—";
  return `${year}年${month}月，${name} ${statusLabel}`;
}

export function localizedJa(text: { ja?: string; en?: string; "zh-CN"?: string } | null | undefined): string {
  if (!text) return "";
  return text.ja ?? text.en ?? text["zh-CN"] ?? "";
}
