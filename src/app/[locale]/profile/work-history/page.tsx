import { getTranslations } from "next-intl/server";
import { LocalizedTextField } from "@/components/localized-text-field";
import { getDb } from "@/db";
import { listWorkHistoryEntries } from "@/lib/data/work-history-entries";
import { WORK_HISTORY_EVENT_CODES } from "@/lib/domain/resume-events";
import type { WorkHistoryEventCode } from "@/lib/domain/resume-events";
import type { LocalizedText } from "@/lib/domain/localized-text";
import {
  deleteWorkHistoryEntryAction,
  requireProfileAccess,
  saveWorkHistoryEntryAction,
} from "@/lib/profile-actions";
import {
  EventSelect,
  YearMonthFields,
  formatYearMonthDate,
} from "../form-fields";

export default async function WorkHistoryPage() {
  const userId = await requireProfileAccess();
  const entries = await listWorkHistoryEntries(getDb(), userId);
  const t = await getTranslations("Profile.workHistory");
  const te = await getTranslations("Profile.events.workHistory");

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("listTitle")}</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-zinc-500">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {entries.map((entry) => {
              const ym = formatYearMonthDate(entry.yearMonth);
              const company = entry.company as LocalizedText;
              return (
                <li key={entry.id} className="space-y-4 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {`${ym.year}/${ym.month} · ${te(entry.eventCode as WorkHistoryEventCode)} · ${company.ja ?? company.en ?? company["zh-CN"] ?? "—"}`}
                    </p>
                    <form
                      action={async () => {
                        "use server";
                        await deleteWorkHistoryEntryAction(entry.id);
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
                  <form action={saveWorkHistoryEntryAction} className="space-y-4">
                    <input type="hidden" name="id" value={entry.id} />
                    <YearMonthFields
                      year={ym.year}
                      month={ym.month}
                      yearLabel={t("year")}
                      monthLabel={t("month")}
                    />
                    <LocalizedTextField
                      fieldPrefix="company"
                      label={t("company")}
                      value={company}
                    />
                    <EventSelect
                      name="eventCode"
                      codes={WORK_HISTORY_EVENT_CODES}
                      value={entry.eventCode}
                      label={t("event")}
                      translate={(code) => te(code as WorkHistoryEventCode)}
                    />
                    <LocalizedTextField
                      fieldPrefix="note"
                      label={t("note")}
                      value={(entry.note ?? {}) as LocalizedText}
                      multiline
                    />
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
        <form action={saveWorkHistoryEntryAction} className="space-y-4">
          <YearMonthFields yearLabel={t("year")} monthLabel={t("month")} />
          <LocalizedTextField fieldPrefix="company" label={t("company")} />
          <EventSelect
            name="eventCode"
            codes={WORK_HISTORY_EVENT_CODES}
            defaultCode="joined"
            label={t("event")}
            translate={(code) => te(code as WorkHistoryEventCode)}
          />
          <LocalizedTextField fieldPrefix="note" label={t("note")} multiline />
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
