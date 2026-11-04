"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  addDays,
  cellOccupancy,
  defaultFreeSlots,
  formatDateKeyShort,
  hourCellRange,
  rawOverlap,
  SLOT_HOURS,
  weekDateKeys,
} from "@/lib/progress-demo/logic";
import type { Application } from "@/lib/progress-demo/types";

const WEEKDAY_KEYS = [
  "calMon",
  "calTue",
  "calWed",
  "calThu",
  "calFri",
  "calSat",
  "calSun",
] as const;

type Draft = { start: string; end: string };

function sameSlot(a: Draft, b: Draft) {
  return a.start === b.start && a.end === b.end;
}

export function SlotGrid({
  apps,
  appId,
  company,
  drafts,
  onChange,
  onConflict,
}: {
  apps: Application[];
  appId: string;
  company: string;
  drafts: Draft[];
  onChange: (next: Draft[]) => void;
  onConflict: (message: string) => void;
}) {
  const t = useTranslations("Board");
  const [monday, setMonday] = useState("2026-11-09");
  const [drag, setDrag] = useState<{ day: string; from: number; to: number } | null>(
    null,
  );
  const days = useMemo(() => weekDateKeys(monday), [monday]);

  const dragHours = drag
    ? rangeHours(drag.from, drag.to)
    : [];

  function occupancy(day: string, hour: number) {
    return cellOccupancy(apps, day, hour, appId);
  }

  function tryToggle(day: string, hour: number) {
    const occ = occupancy(day, hour);
    if (occ === "confirmed") {
      onConflict(t("slotConflictConfirmed"));
      return;
    }
    if (occ === "proposed") {
      onConflict(t("slotConflictProposed"));
      return;
    }
    if (occ === "own") {
      onConflict(t("slotSelfOverlap"));
      return;
    }
    const cell = hourCellRange(day, hour);
    if (drafts.some((draft) => sameSlot(draft, cell))) {
      onChange(drafts.filter((draft) => !sameSlot(draft, cell)));
      return;
    }
    if (drafts.some((draft) => rawOverlap(draft.start, draft.end, cell.start, cell.end))) {
      onConflict(t("slotSelfOverlap"));
      return;
    }
    onChange([...drafts, cell]);
  }

  function commitDrag(day: string, from: number, to: number) {
    if (from === to) {
      tryToggle(day, from);
      return;
    }
    const hours = rangeHours(from, to);
    let blocked = false;
    let next = [...drafts];
    for (const hour of hours) {
      const occ = occupancy(day, hour);
      if (occ === "confirmed" || occ === "proposed" || occ === "own") {
        blocked = true;
        continue;
      }
      const cell = hourCellRange(day, hour);
      if (!next.some((draft) => sameSlot(draft, cell))) next = [...next, cell];
    }
    onChange(next);
    if (blocked) {
      onConflict(
        occupancy(day, from) === "confirmed" || occupancy(day, to) === "confirmed"
          ? t("slotConflictConfirmed")
          : t("slotConflictProposed"),
      );
    }
  }

  return (
    <div data-testid="slot-grid" className="flex flex-col gap-3">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {t("slotGridHint")}
        <span lang="ja">{` ${company}`}</span>
      </p>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-700" />
          {t("calConfirmed")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />
          {t("calProposed")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-sky-600" />
          {t("slotYours")}
        </span>
        <span className="text-zinc-500">{t("slotPicked", { count: drafts.length })}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700"
          onClick={() => setMonday(addDays(monday, -7))}
        >
          {t("slotWeekPrev")}
        </button>
        <p className="font-medium">
          {`${formatDateKeyShort(days[0]!)} – ${formatDateKeyShort(days[6]!)}`}
        </p>
        <button
          type="button"
          className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700"
          onClick={() => setMonday(addDays(monday, 7))}
        >
          {t("slotWeekNext")}
        </button>
      </div>
      <div
        className="overflow-x-auto"
        onPointerUp={() => {
          if (drag) {
            commitDrag(drag.day, drag.from, drag.to);
            setDrag(null);
          }
        }}
        onPointerLeave={() => {
          if (drag) {
            commitDrag(drag.day, drag.from, drag.to);
            setDrag(null);
          }
        }}
      >
        <div className="grid min-w-[44rem] grid-cols-[3rem_repeat(7,minmax(0,1fr))] gap-px rounded-lg border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
          <div className="bg-zinc-50 dark:bg-zinc-900" />
          {days.map((day, index) => (
            <div
              key={day}
              className="bg-zinc-50 px-1 py-1.5 text-center text-xs font-medium dark:bg-zinc-900"
            >
              <div>{t(WEEKDAY_KEYS[index]!)}</div>
              <div className="text-zinc-500">{formatDateKeyShort(day)}</div>
            </div>
          ))}
          {SLOT_HOURS.map((hour) => (
            <HourRow
              key={hour}
              hour={hour}
              days={days}
              appId={appId}
              apps={apps}
              drafts={drafts}
              drag={drag}
              dragHours={dragHours}
              onPointerDown={(day, cellHour) => {
                const occ = occupancy(day, cellHour);
                if (occ === "confirmed" || occ === "proposed" || occ === "own") {
                  tryToggle(day, cellHour);
                  return;
                }
                setDrag({ day, from: cellHour, to: cellHour });
              }}
              onPointerEnter={(day, cellHour) => {
                setDrag((current) =>
                  current && current.day === day
                    ? { ...current, to: cellHour }
                    : current,
                );
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function HourRow({
  hour,
  days,
  apps,
  appId,
  drafts,
  drag,
  dragHours,
  onPointerDown,
  onPointerEnter,
}: {
  hour: number;
  days: string[];
  apps: Application[];
  appId: string;
  drafts: Draft[];
  drag: { day: string; from: number; to: number } | null;
  dragHours: number[];
  onPointerDown: (day: string, hour: number) => void;
  onPointerEnter: (day: string, hour: number) => void;
}) {
  return (
    <>
      <div className="bg-zinc-50 px-1 py-2 text-right text-[11px] text-zinc-500 dark:bg-zinc-900">
        {`${hour}:00`}
      </div>
      {days.map((day) => {
        const occ = cellOccupancy(apps, day, hour, appId);
        const cell = hourCellRange(day, hour);
        const picked = drafts.some((draft) => sameSlot(draft, cell));
        const dragging = drag?.day === day && dragHours.includes(hour);
        let className = "min-h-9 cursor-pointer bg-white dark:bg-zinc-950";
        if (occ === "confirmed") className = "min-h-9 cursor-not-allowed bg-emerald-700 text-white";
        else if (occ === "proposed") className = "min-h-9 cursor-not-allowed bg-amber-400 text-amber-950";
        else if (occ === "own") className = "min-h-9 cursor-not-allowed bg-amber-100 text-amber-900";
        else if (picked || dragging) className = "min-h-9 cursor-pointer bg-sky-600 text-white";
        return (
          <button
            key={`${day}-${hour}`}
            type="button"
            data-testid={`slot-cell-${day}-${hour}`}
            data-occupancy={occ ?? "free"}
            aria-pressed={picked || dragging}
            className={className}
            onPointerDown={(event) => {
              event.preventDefault();
              onPointerDown(day, hour);
            }}
            onPointerEnter={() => onPointerEnter(day, hour)}
          />
        );
      })}
    </>
  );
}

function rangeHours(from: number, to: number) {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const hours: number[] = [];
  for (let hour = lo; hour <= hi; hour += 1) hours.push(hour);
  return hours;
}

export function initialDrafts(apps: Application[], appId: string): Draft[] {
  return defaultFreeSlots(apps, appId, 3);
}
