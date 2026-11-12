import { SLOT_DURATION_MS, TOKYO } from "./enums";

/** Default interview length when the form only collects a start time. */
export function endOneHourAfter(startIso: string): string {
  return new Date(new Date(startIso).getTime() + SLOT_DURATION_MS).toISOString();
}

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

export function tokyoNowParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TOKYO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  return { year: get("year"), month: get("month"), day: get("day") };
}

export function addDays(dateKey: string, days: number): string {
  const noon = new Date(`${dateKey}T12:00:00+09:00`);
  noon.setUTCDate(noon.getUTCDate() + days);
  const y = noon.getUTCFullYear();
  const m = String(noon.getUTCMonth() + 1).padStart(2, "0");
  const d = String(noon.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function mondayContaining(dateKey: string): string {
  const noon = new Date(`${dateKey}T12:00:00+09:00`);
  const offset = (noon.getUTCDay() + 6) % 7;
  return addDays(dateKey, -offset);
}

export function weekDateKeys(mondayKey: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(mondayKey, index));
}

export function formatDateKeyShort(dateKey: string): string {
  const parts = dateKey.split("-");
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

export function tokyoTodayKey(now = new Date()): string {
  return tokyoDateKey(now.toISOString());
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
