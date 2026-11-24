"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useNavChrome } from "@/components/app-shell/nav-chrome-context";
import { changeLocale } from "@/lib/locale-actions";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/lib/locale";

export function SettingsForm() {
  const t = useTranslations("SettingsPage");
  const tNav = useTranslations("Nav");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { collapsed, setCollapsed } = useNavChrome();

  return (
    <div className="flex flex-col gap-6">
      <section className="app-info-card">
        <h2 className="app-info-card-title">{t("displayTitle")}</h2>
        <label className="mc-field">
          {tNav("language")}
          <select
            aria-label={tNav("language")}
            value={locale}
            disabled={pending}
            className="site-locale-select"
            data-testid="settings-locale"
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
      </section>

      <section className="app-info-card">
        <h2 className="app-info-card-title">{t("sidebarTitle")}</h2>
        <fieldset className="settings-sidebar-field">
          <legend className="sr-only">{t("sidebarTitle")}</legend>
          <label className="settings-radio">
            <input
              type="radio"
              name="sidebar"
              checked={!collapsed}
              data-testid="settings-sidebar-expanded"
              onChange={() => setCollapsed(false)}
            />
            <span>{t("sidebarExpanded")}</span>
          </label>
          <label className="settings-radio">
            <input
              type="radio"
              name="sidebar"
              checked={collapsed}
              data-testid="settings-sidebar-collapsed"
              onChange={() => setCollapsed(true)}
            />
            <span>{t("sidebarCollapsed")}</span>
          </label>
        </fieldset>
      </section>
    </div>
  );
}
