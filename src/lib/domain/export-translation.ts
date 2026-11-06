import type { Locale } from "@/lib/locale";

/**
 * Export milestone: translate Japanese resume copy to zh-CN / en for PDF/Word output.
 * TODO(M-export): Wire an approved translation API; do not call unapproved third-party services.
 */
export function translateResumeTextForExport(
  japanese: string,
  targetLocale: Exclude<Locale, "ja">,
): string {
  void targetLocale;
  return japanese;
}
