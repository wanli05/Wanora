const TOKYO = "Asia/Tokyo";

/** 満年齢 as of `asOf` (default: today in Tokyo). */
export function fullYearsOld(
  birthDate: Date,
  asOf: Date = new Date(),
): number {
  const birth = toTokyoParts(birthDate);
  const ref = toTokyoParts(asOf);
  let age = ref.year - birth.year;
  if (
    ref.month < birth.month ||
    (ref.month === birth.month && ref.day < birth.day)
  ) {
    age -= 1;
  }
  return age;
}

function toTokyoParts(d: Date): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TOKYO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [year, month, day] = fmt.format(d).split("-").map(Number);
  return { year, month, day };
}

export type DateFormatPreference = "wareki" | "seireki";

/** Format a calendar date for Japanese resume copy (wareki or western year). */
export function formatJapaneseResumeDate(
  date: Date,
  format: DateFormatPreference,
): string {
  if (format === "seireki") {
    const p = toTokyoParts(date);
    return `${p.year}年${p.month}月${p.day}日`;
  }
  return new Intl.DateTimeFormat("ja-JP-u-ca-japanese", {
    timeZone: TOKYO,
    era: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/** Year and month column for 学歴・職歴 tables (always numeric month). */
export function formatYearMonthColumn(
  yearMonth: Date,
  format: DateFormatPreference,
): { yearLabel: string; monthLabel: string } {
  const p = toTokyoParts(yearMonth);
  const monthLabel = String(p.month);
  if (format === "seireki") {
    return { yearLabel: String(p.year), monthLabel };
  }
  const warekiYear = new Intl.DateTimeFormat("ja-JP-u-ca-japanese", {
    timeZone: TOKYO,
    era: "long",
    year: "numeric",
  }).format(yearMonth);
  return { yearLabel: warekiYear.replace(/年$/, ""), monthLabel };
}

/** Parse HTML date input `YYYY-MM-DD` to UTC midnight (date-only). */
export function parseDateInput(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** First day of month for DB `date` columns (year_month). */
export function yearMonthFromInput(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

/** HTML `<input type="month">` value from year and month. */
export function formatYearMonthInputValue(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Parse HTML month input or `YYYY-MM` into calendar parts. */
export function parseYearMonthInputValue(value: string): {
  year: number;
  month: number;
} {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new Error("invalid year month");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error("invalid year month");
  }
  return { year, month };
}

/** Profile table display: `2020年4月`. */
export function formatYearMonthJa(year: number, month: number): string {
  return `${year}年${month}月`;
}

export function yearMonthFromInputValue(value: string): Date {
  const { year, month } = parseYearMonthInputValue(value);
  return yearMonthFromInput(year, month);
}
