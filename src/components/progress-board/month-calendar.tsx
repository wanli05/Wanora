"use client";

import { useTranslations } from "next-intl";
import {
  formatTokyoShort,
  monthCells,
  occupiedWindows,
  tokyoDateKey,
} from "@/lib/progress-demo/logic";
import type { Application } from "@/lib/progress-demo/types";

const WEEKDAYS = [
  "calMon",
  "calTue",
  "calWed",
  "calThu",
  "calFri",
  "calSat",
  "calSun",
] as const;

export function MonthCalendar({
  apps,
  year,
  monthIndex,
}: {
  apps: Application[];
  year: number;
  monthIndex: number;
}) {
  const t = useTranslations("Board");
  const cells = monthCells(year, monthIndex);
  const events = occupiedWindows(apps);

  return (
    <div data-testid="month-calendar" className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-emerald-700" />
          {t("calConfirmed")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-amber-500" />
          {t("calProposed")}
        </span>
      </div>
      <div className="grid grid-cols-7 gap-px rounded-lg border border-zinc-200 bg-zinc-200 text-xs dark:border-zinc-800 dark:bg-zinc-800">
        {WEEKDAYS.map((key) => (
          <div
            key={key}
            className="bg-zinc-50 px-1 py-1.5 text-center font-medium text-zinc-500 dark:bg-zinc-900"
          >
            {t(key)}
          </div>
        ))}
        {cells.map((cell) => {
          const dayEvents = events.filter(
            (event) => tokyoDateKey(event.start) === cell.key,
          );
          return (
            <div
              key={cell.key}
              data-testid={`cal-day-${cell.key}`}
              className={`min-h-[5.5rem] bg-white p-1 dark:bg-zinc-950 ${
                cell.inMonth ? "" : "opacity-40"
              }`}
            >
              <div className="mb-1 text-[11px] text-zinc-500">{cell.day}</div>
              <ul className="flex flex-col gap-0.5">
                {dayEvents.slice(0, 3).map((event) => (
                  <li
                    key={`${event.kind}-${event.company}-${event.start}`}
                    className={`truncate rounded px-1 py-0.5 ${
                      event.kind === "confirmed"
                        ? "bg-emerald-700 text-white"
                        : "bg-amber-100 text-amber-950 dark:bg-amber-900 dark:text-amber-50"
                    }`}
                    lang="ja"
                    title={`${event.company} ${formatTokyoShort(event.start)}`}
                  >
                    {`${formatTokyoShort(event.start).split(" ")[1] ?? ""} ${event.company}`}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
