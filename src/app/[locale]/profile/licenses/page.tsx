import { getTranslations } from "next-intl/server";
import { JapaneseTextField } from "@/components/japanese-text-field";
import { getDb } from "@/db";
import { listLicenses } from "@/lib/data/licenses";
import { LICENSE_STATUSES } from "@/lib/domain/resume-events";
import type { LicenseStatus } from "@/lib/domain/resume-events";
import type { LocalizedText } from "@/lib/domain/localized-text";
import {
  deleteLicenseAction,
  requireProfileAccess,
  saveLicenseAction,
} from "@/lib/profile-actions";
import {
  EventSelect,
  YearMonthFields,
  formatYearMonthDate,
} from "../form-fields";

export default async function LicensesPage() {
  const userId = await requireProfileAccess();
  const entries = await listLicenses(getDb(), userId);
  const t = await getTranslations("Profile.licenses");
  const tField = await getTranslations("Profile.japaneseField");
  const ts = await getTranslations("Profile.events.licenseStatus");

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("listTitle")}</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-zinc-500">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {entries.map((entry) => {
              const ym = formatYearMonthDate(entry.acquiredYm);
              const name = entry.name as LocalizedText;
              return (
                <li key={entry.id} className="space-y-4 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {`${ym.year}/${ym.month} · ${ts(entry.status as LicenseStatus)} · ${name.ja ?? name.en ?? name["zh-CN"] ?? "—"}`}
                    </p>
                    <form
                      action={async () => {
                        "use server";
                        await deleteLicenseAction(entry.id);
                      }}
                    >
                      <button
                        type="submit"
                        className="text-sm text-red-600 hover:underline"
                      >
                        {t("delete")}
                      </button>
                    </form>
                  </div>
                  <form action={saveLicenseAction} className="space-y-4">
                    <input type="hidden" name="id" value={entry.id} />
                    <YearMonthFields
                      year={ym.year}
                      month={ym.month}
                      yearLabel={t("year")}
                      monthLabel={t("month")}
                    />
                    <JapaneseTextField
                      fieldPrefix="name"
                      label={t("name")}
                      value={name}
                      required
                      hint={tField("hint")}
                    />
                    <EventSelect
                      name="status"
                      codes={LICENSE_STATUSES}
                      value={entry.status}
                      label={t("status")}
                      translate={(code) => ts(code as LicenseStatus)}
                    />
                    <label className="block space-y-1 text-sm">
                      <span className="font-medium">{t("score")}</span>
                      <input
                        name="score"
                        defaultValue={entry.score ?? ""}
                        className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                      />
                    </label>
                    <button
                      type="submit"
                      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
                    >
                      {t("update")}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="space-y-4 rounded-md border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="text-lg font-semibold">{t("addTitle")}</h2>
        <form action={saveLicenseAction} className="space-y-4">
          <YearMonthFields yearLabel={t("year")} monthLabel={t("month")} />
          <JapaneseTextField fieldPrefix="name" label={t("name")} required hint={tField("hint")} />
          <EventSelect
            name="status"
            codes={LICENSE_STATUSES}
            defaultCode="acquired"
            label={t("status")}
            translate={(code) => ts(code as LicenseStatus)}
          />
          <label className="block space-y-1 text-sm">
            <span className="font-medium">{t("score")}</span>
            <input
              name="score"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            {t("add")}
          </button>
        </form>
      </section>
    </div>
  );
}
