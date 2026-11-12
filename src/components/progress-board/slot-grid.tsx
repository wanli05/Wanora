"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { OccupancyWindow } from "@/lib/progress/conflicts";
import {
  cellRange,
  occupancyAt,
  sameSlot,
  slotStarts,
  toggleDraftSlot,
  type DraftSlot,
} from "@/lib/progress/slots";
import {
  addDays,
  formatDateKeyShort,
  mondayContaining,
  tokyoTodayKey,
  weekDateKeys,
} from "@/lib/progress/tokyo";

const WEEKDAY_KEYS = [
  "calMon",
  "calTue",
  "calWed",
  "calThu",
  "calFri",
  "calSat",
  "calSun",
] as const;

export function SlotGrid({
  occupancy,
  appId,
  company,
  drafts,
  onChange,
  onConflict,
}: {
  occupancy: OccupancyWindow[];
  appId: string;
  company: string;
  drafts: DraftSlot[];
  onChange: (next: DraftSlot[]) => void;
  onConflict: (message: string) => void;
}) {
  const t = useTranslations("Board");
  const [monday, setMonday] = useState(() => mondayContaining(tokyoTodayKey()));
  const [drag, setDrag] = useState<{
    day: string;
    from: number;
    to: number;
  } | null>(null);
  const days = useMemo(() => weekDateKeys(monday), [monday]);
  const starts = slotStarts();

  function conflictText(kind: string | undefined) {
    if (kind === "confirmed") return t("slotConflictConfirmed");
    if (kind === "busy") return t("slotConflictBusy");
    if (kind === "own") return t("slotSelfOverlap");
    return t("slotConflictProposed");
  }

  function tryToggle(day: string, index: number) {
    const cell = starts[index];
    if (!cell) return;
    const range = cellRange(day, cell.hour, cell.minute);
    const result = toggleDraftSlot(drafts, range, occupancy, appId);
    if (result.blocked) {
      onConflict(conflictText(result.blocked.kind));
      return;
    }
    onChange(result.drafts);
  }

  function commitDrag(day: string, from: number, to: number) {
    if (from === to) {
      tryToggle(day, from);
      return;
    }
    const lo = Math.min(from, to);
    const aligned = starts[lo];
    if (!aligned) return;
    const range = cellRange(day, aligned.hour, aligned.minute);
    const result = toggleDraftSlot(drafts, range, occupancy, appId);
    if (result.blocked) onConflict(conflictText(result.blocked.kind));
    else onChange(result.drafts);
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
          <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-amber-700 bg-amber-200" />
          {t("calProposed")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-sky-600" />
          {t("slotYours")}
        </span>
        <span className={drafts.length < 3 ? "text-amber-700" : "text-zinc-500"}>
          {t("slotPicked", { count: drafts.length })}
          {drafts.length < 3 ? ` · ${t("slotPickedWarn")}` : ""}
        </span>
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
        className="max-h-[28rem] overflow-auto"
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
        <div className="grid min-w-[48rem] grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] gap-px rounded-lg border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
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
          {starts.map((cell, index) => (
            <CellRow
              key={cell.label}
              cell={cell}
              index={index}
              days={days}
              occupancy={occupancy}
              appId={appId}
              drafts={drafts}
              drag={drag}
              onPointerDown={(day, cellIndex) => {
                const start = starts[cellIndex];
                if (!start) return;
                const range = cellRange(day, start.hour, start.minute);
                const blocked = occupancyAt(
                  occupancy,
                  range.start,
                  range.end,
                  appId,
                );
                if (blocked && !drafts.some((draft) => sameSlot(draft, range))) {
                  tryToggle(day, cellIndex);
                  return;
                }
                setDrag({ day, from: cellIndex, to: cellIndex });
              }}
              onPointerEnter={(day, cellIndex) => {
                setDrag((current) =>
                  current && current.day === day
                    ? { ...current, to: cellIndex }
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

function CellRow({
  cell,
  index,
  days,
  occupancy,
  appId,
  drafts,
  drag,
  onPointerDown,
  onPointerEnter,
}: {
  cell: { hour: number; minute: number; label: string };
  index: number;
  days: string[];
  occupancy: OccupancyWindow[];
  appId: string;
  drafts: DraftSlot[];
  drag: { day: string; from: number; to: number } | null;
  onPointerDown: (day: string, index: number) => void;
  onPointerEnter: (day: string, index: number) => void;
}) {
  const lo = drag ? Math.min(drag.from, drag.to) : -1;
  return (
    <>
      <div className="bg-zinc-50 px-1 py-1 text-right text-[11px] text-zinc-500 dark:bg-zinc-900">
        {cell.label}
      </div>
      {days.map((day) => {
        const range = cellRange(day, cell.hour, cell.minute);
        const hit = occupancyAt(occupancy, range.start, range.end, appId);
        const picked = drafts.some((draft) => sameSlot(draft, range));
        const dragging = drag?.day === day && index === lo;
        let className = "min-h-7 cursor-pointer bg-white dark:bg-zinc-950";
        if (hit?.kind === "confirmed") {
          className = "min-h-7 cursor-not-allowed bg-emerald-700 text-white";
        } else if (hit?.kind === "proposed") {
          className =
            "min-h-7 cursor-not-allowed bg-[repeating-linear-gradient(45deg,#fbbf24,#fbbf24_4px,#fff7ed_4px,#fff7ed_8px)]";
        } else if (hit?.kind === "busy") {
          className = "min-h-7 cursor-not-allowed bg-zinc-300 dark:bg-zinc-700";
        } else if (picked || dragging) {
          className = "min-h-7 cursor-pointer bg-sky-600 text-white";
        }
        return (
          <button
            key={`${day}-${cell.label}`}
            type="button"
            data-testid={`slot-cell-${day}-${cell.label}`}
            data-occupancy={hit?.kind ?? "free"}
            aria-pressed={picked || dragging}
            className={className}
            onPointerDown={(event) => {
              event.preventDefault();
              onPointerDown(day, index);
            }}
            onPointerEnter={() => onPointerEnter(day, index)}
          />
        );
      })}
    </>
  );
}
