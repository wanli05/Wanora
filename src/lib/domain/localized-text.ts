import { z } from "zod";
import { LOCALES, type Locale } from "@/lib/locale";

/** User-facing content stored per document/UI language (jsonb in Postgres). */
export type LocalizedText = Partial<Record<Locale, string>>;

export const localizedTextSchema = z
  .object({
    ja: z.string().optional(),
    "zh-CN": z.string().optional(),
    en: z.string().optional(),
  })
  .strict();

export type ResolvedLocalizedText = {
  value: string;
  /** Language the string was taken from. */
  sourceLocale: Locale;
  /** True when `sourceLocale` differs from the requested locale. */
  usedFallback: boolean;
};

function normalizeEntry(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Parse and drop empty strings so Zod + DB stay consistent. */
export function parseLocalizedText(input: unknown): LocalizedText {
  const parsed = localizedTextSchema.parse(input ?? {});
  const out: LocalizedText = {};
  for (const locale of LOCALES) {
    const v = normalizeEntry(parsed[locale]);
    if (v) out[locale] = v;
  }
  return out;
}

export function localizedTextFromForm(
  formData: FormData,
  fieldPrefix: string,
): LocalizedText {
  const raw: Record<string, string | undefined> = {};
  for (const locale of LOCALES) {
    raw[locale] = formData.get(`${fieldPrefix}_${locale}`)?.toString();
  }
  return parseLocalizedText(raw);
}

/** Profile/resume forms: single Japanese input (`${prefix}_ja`), stored as LocalizedText. */
export function japaneseTextFromForm(
  formData: FormData,
  fieldPrefix: string,
): LocalizedText {
  const ja = normalizeEntry(
    formData.get(`${fieldPrefix}_ja`)?.toString(),
  );
  if (ja) return { ja };
  return localizedTextFromForm(formData, fieldPrefix);
}

export function optionalJapaneseFromForm(
  formData: FormData,
  fieldPrefix: string,
): LocalizedText | null {
  const text = japaneseTextFromForm(formData, fieldPrefix);
  return text.ja ? { ja: text.ja } : null;
}

export function requireJapaneseFromForm(
  formData: FormData,
  fieldPrefix: string,
): LocalizedText | null {
  const text = japaneseTextFromForm(formData, fieldPrefix);
  return text.ja ? { ja: text.ja } : null;
}

const FALLBACK_ORDER: Record<Locale, readonly Locale[]> = {
  ja: ["ja", "en", "zh-CN"],
  "zh-CN": ["zh-CN", "en", "ja"],
  en: ["en", "ja", "zh-CN"],
};

/** Pick text for `locale`, optionally falling back to other languages. */
export function resolveLocalizedText(
  text: LocalizedText | null | undefined,
  locale: Locale,
  options?: { allowFallback?: boolean },
): ResolvedLocalizedText | null {
  if (!text) return null;
  const order = FALLBACK_ORDER[locale];
  for (const candidate of order) {
    const value = normalizeEntry(text[candidate]);
    if (value) {
      return {
        value,
        sourceLocale: candidate,
        usedFallback: candidate !== locale,
      };
    }
  }
  if (options?.allowFallback === false) return null;
  return null;
}

export function hasLocalizedValue(
  text: LocalizedText | null | undefined,
  locale: Locale,
): boolean {
  return Boolean(normalizeEntry(text?.[locale]));
}

/** Per-locale fill state for completion UI. */
export function localizedTextCompletion(
  text: LocalizedText | null | undefined,
): Record<Locale, boolean> {
  return Object.fromEntries(
    LOCALES.map((locale) => [locale, hasLocalizedValue(text, locale)]),
  ) as Record<Locale, boolean>;
}

export function countLocalizedFilled(
  text: LocalizedText | null | undefined,
): number {
  return LOCALES.filter((l) => hasLocalizedValue(text, l)).length;
}
