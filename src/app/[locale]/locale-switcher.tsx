"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { changeLocale } from "@/lib/locale-actions";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/lib/locale";
import { reloadPage } from "@/lib/reload";

export function LocaleSwitcher() {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">{t("language")}</span>
      <select
        aria-label={t("language")}
        value={locale}
        disabled={pending}
        className="rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
        onChange={(event) => {
          const next = event.target.value as Locale;
          startTransition(async () => {
            await changeLocale(next);
            // URLs carry no locale, so the client router cache would keep
            // serving pages rendered in the old language; reload instead.
            reloadPage();
          });
        }}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
