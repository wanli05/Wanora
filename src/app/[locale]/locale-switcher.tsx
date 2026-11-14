"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { changeLocale } from "@/lib/locale-actions";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/lib/locale";

export function LocaleSwitcher() {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className="site-locale">
      <span className="sr-only">{t("language")}</span>
      <select
        aria-label={t("language")}
        value={locale}
        disabled={pending}
        className="site-locale-select"
        onChange={(event) => {
          const next = event.target.value as Locale;
          if (next === locale) return;
          startTransition(() => {
            void (async () => {
              await changeLocale(next);
              router.refresh();
            })();
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
