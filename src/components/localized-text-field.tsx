"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/locale";
import {
  localizedTextCompletion,
  type LocalizedText,
} from "@/lib/domain/localized-text";

type Props = {
  fieldPrefix: string;
  label: string;
  value?: LocalizedText | null;
  multiline?: boolean;
};

export function LocalizedTextField({
  fieldPrefix,
  label,
  value,
  multiline = false,
}: Props) {
  const t = useTranslations("Profile.localizedField");
  const completion = useMemo(
    () => localizedTextCompletion(value ?? {}),
    [value],
  );
  const [active, setActive] = useState<Locale>(
    LOCALES.find((l) => completion[l]) ?? "ja",
  );

  const Input = multiline ? "textarea" : "input";

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label={t("tabsAria", { label })}
      >
        {LOCALES.map((locale) => (
          <button
            key={locale}
            type="button"
            role="tab"
            aria-selected={active === locale}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              active === locale
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            }`}
            onClick={() => setActive(locale)}
          >
            {LOCALE_NAMES[locale]}
            <span
              className={`ml-1 inline-block size-1.5 rounded-full ${
                completion[locale] ? "bg-emerald-500" : "bg-zinc-400"
              }`}
              aria-hidden
            />
          </button>
        ))}
      </div>
      {LOCALES.map((locale) => (
        <div
          key={locale}
          role="tabpanel"
          hidden={active !== locale}
          className="space-y-1"
        >
          <label className="sr-only" htmlFor={`${fieldPrefix}_${locale}`}>
            {t("inputLabel", { label, locale: LOCALE_NAMES[locale] })}
          </label>
          <Input
            id={`${fieldPrefix}_${locale}`}
            name={`${fieldPrefix}_${locale}`}
            defaultValue={value?.[locale] ?? ""}
            rows={multiline ? 3 : undefined}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
      ))}
      <p className="text-xs text-zinc-500">
        {t("completion", { filled: LOCALES.filter((l) => completion[l]).length, total: LOCALES.length })}
      </p>
    </fieldset>
  );
}
