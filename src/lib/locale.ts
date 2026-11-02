import { z } from "zod";

export const LOCALES = ["ja", "zh-CN", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ja";

// Each language is named in itself so users can find theirs from any UI language.
export const LOCALE_NAMES: Record<Locale, string> = {
  ja: "日本語",
  "zh-CN": "简体中文",
  en: "English",
};

export const localeSchema = z.enum(LOCALES);

export function isLocale(value: unknown): value is Locale {
  return localeSchema.safeParse(value).success;
}
