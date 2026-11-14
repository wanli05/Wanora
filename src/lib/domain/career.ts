import { z } from "zod";
import {
  CAREER_GOAL_KINDS,
  CAREER_PROJECT_STATUSES,
  type CareerGoalKind,
  type CareerProjectStatus,
} from "@/db/schema";
import type { LocalizedText } from "@/lib/domain/localized-text";

export type CareerLanguage = { language: string; level: string };

export const careerLanguageSchema = z.object({
  language: z.string().trim().min(1),
  level: z.string().trim().min(1),
});

export const careerProjectStatusSchema = z.enum(CAREER_PROJECT_STATUSES);
export const careerGoalKindSchema = z.enum(CAREER_GOAL_KINDS);

export type { CareerGoalKind, CareerProjectStatus };

export type CareerTimelineKind =
  | "education"
  | "work"
  | "project"
  | "license"
  | "skill"
  | "goal";

export type CareerTimelineItem = {
  id: string;
  kind: CareerTimelineKind;
  at: string;
  title: string;
  summary?: string;
  module: "profile" | "work" | "projects" | "skills" | "goals";
  /** User entry order (earlier = smaller). Same-`at` items render L→R by this. */
  entryOrder: number;
};

export function parseDirectionTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
}

export function parseStrengths(raw: unknown): string[] {
  return parseDirectionTags(raw);
}

/** True when nationality indicates a Japanese national (locks 在留 fields). */
export function isJapaneseNationality(
  value: string | null | undefined,
): boolean {
  const raw = value?.trim().normalize("NFKC") ?? "";
  if (!raw) return false;
  const lower = raw.toLowerCase();
  if (
    lower === "japan" ||
    lower === "japanese" ||
    lower === "jp" ||
    lower === "jpn"
  ) {
    return true;
  }
  return raw === "日本" || raw === "日本国" || raw === "日本人";
}

export function parseLanguages(raw: unknown): CareerLanguage[] {
  if (!Array.isArray(raw)) return [];
  const out: CareerLanguage[] = [];
  for (const item of raw) {
    const parsed = careerLanguageSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export function jaOf(text: LocalizedText | null | undefined): string {
  return text?.ja?.trim() ?? "";
}

/** 「○年○月○日現在」 for Asia/Tokyo export day. */
export function formatExportAsOfJa(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}年${m}月${d}日現在`;
}

export function formatExportAsOfRirekisho(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}　年　${m}月　${d}日現在`;
}
