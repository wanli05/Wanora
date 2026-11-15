import type { LocalizedText } from "@/lib/domain/localized-text";

/**
 * Profile columns that must never leave the server toward an LLM in Phase 1A.
 * Whitelist is authoritative; this list documents / tests the exclusion set.
 */
export const MY_CAREER_DENIED_PROFILE_FIELDS = [
  "phone",
  "email",
  "postalCode",
  "address",
  "addressKana",
  "altContact",
  "photoKey",
  "residenceStatus",
  "residencePeriod",
  "residenceUntil",
  "salaryAnnualMan",
  "salaryBonusMan",
  "salaryMonthlyMan",
  "salaryOvertimeMan",
  "salaryHope",
  "dependentsCount",
  "hasSpouse",
  "spouseDependent",
  "birthDate",
  "gender",
  "fullNameKana",
  "commuteHours",
  "commuteMinutes",
] as const;

export type MyCareerDeniedProfileField =
  (typeof MY_CAREER_DENIED_PROFILE_FIELDS)[number];

/** Safe career-profile fields for AI context. */
export const MY_CAREER_PROFILE_WHITELIST = [
  "fullName",
  "headline",
  "directionTags",
  "selfPr",
  "jobSummary",
  "strengths",
  "languages",
  "nationality",
  "nearestStation",
  "personalHope",
] as const;

export type MyCareerProfileWhitelistField =
  (typeof MY_CAREER_PROFILE_WHITELIST)[number];

export function pickFields<T extends Record<string, unknown>, K extends keyof T>(
  row: T,
  keys: readonly K[],
): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of keys) {
    out[key] = row[key];
  }
  return out;
}

/** Prefer Japanese resume text; drop empty locales to shrink context. */
export function jaLocalized(
  text: LocalizedText | null | undefined,
): { ja: string } | null {
  const ja = text?.ja?.trim();
  return ja ? { ja } : null;
}

export function dateToYm(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Deep-scan helper for tests: ensure denied keys are absent. */
export function collectObjectKeys(value: unknown, into = new Set<string>()) {
  if (Array.isArray(value)) {
    for (const item of value) collectObjectKeys(item, into);
    return into;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      into.add(k);
      collectObjectKeys(v, into);
    }
  }
  return into;
}

export function containsDeniedProfileField(value: unknown): string | null {
  const keys = collectObjectKeys(value);
  for (const denied of MY_CAREER_DENIED_PROFILE_FIELDS) {
    if (keys.has(denied)) return denied;
  }
  return null;
}
