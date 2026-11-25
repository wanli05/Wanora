"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { OccupancyWindow } from "@/lib/progress/conflicts";
import {
  applyDragRange,
  cellRange,
  draftCoversRange,
  draftOverlapsRange,
  occupancyAt,
  rangeFromCellIndices,
  removeDraftSlot,
  sameSlot,
  slotStarts,
  type DraftSlot,
} from "@/lib/progress/slots";
import {
  addDays,
  formatDateKeyShort,
  formatTokyoShort,
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
  baseline = [],
  onChange,
  onConflict,
}: {
  occupancy: OccupancyWindow[];
  appId: string;
  company: string;
  drafts: DraftSlot[];
  /** Saved slots when the editor opened — painted as 登録済み. */
  baseline?: DraftSlot[];
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
  const dragMoved = useRef(false);
  const days = useMemo(() => weekDateKeys(monday), [monday]);
  const starts = slotStarts();

  function conflictText(kind: string | undefined) {
    if (kind === "confirmed") return t("slotConflictConfirmed");
    if (kind === "busy") return t("slotConflictBusy");
    if (kind === "own") return t("slotSelfOverlap");
    return t("slotConflictProposed");
  }

  function commitDrag(day: string, from: number, to: number) {
    const single = from === to && !dragMoved.current;
    const range = rangeFromCellIndices(day, starts, from, to);
    if (!range) return;
    const result = applyDragRange(drafts, range, occupancy, appId, single);
    if (result.blocked) onConflict(conflictText(result.blocked.kind));
    else onChange(result.drafts);
  }

  function isRegistered(draft: DraftSlot) {
    return baseline.some((item) => sameSlot(item, draft));
  }

  const blocksOnWeek = drafts.filter((draft) =>
    days.some((day) => {
      const dayStart = `${day}T00:00:00+09:00`;
      const dayEnd = `${day}T23:59:59+09:00`;
      return draftOverlapsRange(draft, { start: dayStart, end: dayEnd });
    }),
  );

  return (
    <div data-testid="slot-grid" className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="text-sm text-[var(--pb-muted)]">
        {t("slotGridHint")}
        <span lang="ja">{` ${company}`}</span>
      </p>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--pb-amber-bg)] ring-1 ring-[var(--pb-amber)]" />
          {t("slotRegistered")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--pb-teal)]" />
          {t("slotYours")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-700" />
          {t("calConfirmed")}
        </span>
        <span className={drafts.length < 3 ? "text-amber-700" : "text-[var(--pb-muted)]"}>
          {t("slotPicked", { count: drafts.length })}
          {drafts.length < 3 ? ` · ${t("slotPickedWarn")}` : ""}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          className="rounded border border-[var(--pb-line)] px-2 py-1"
          onClick={() => setMonday(addDays(monday, -7))}
        >
          {t("slotWeekPrev")}
        </button>
        <p className="font-medium">
          {`${formatDateKeyShort(days[0]!)} – ${formatDateKeyShort(days[6]!)}`}
        </p>
        <button
          type="button"
          className="rounded border border-[var(--pb-line)] px-2 py-1"
          onClick={() => setMonday(addDays(monday, 7))}
        >
          {t("slotWeekNext")}
        </button>
      </div>
      <div
        className="min-h-0 flex-1 overflow-auto"
        onPointerUp={() => {
          if (drag) {
            commitDrag(drag.day, drag.from, drag.to);
            setDrag(null);
            dragMoved.current = false;
          }
        }}
        onPointerCancel={() => {
          setDrag(null);
          dragMoved.current = false;
        }}
      >
        <div className="grid min-w-[42rem] grid-cols-[3rem_repeat(7,minmax(0,1fr))] gap-px rounded-lg border border-[var(--pb-line)] bg-[var(--pb-line)]">
          <div className="bg-[var(--pb-card)]" />
          {days.map((day, index) => (
            <div
              key={day}
              className="bg-[var(--pb-card)] px-1 py-1.5 text-center text-[11px] font-medium"
            >
              <div>{t(WEEKDAY_KEYS[index]!)}</div>
              <div className="text-[var(--pb-muted)]">{formatDateKeyShort(day)}</div>
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
              baseline={baseline}
              drag={drag}
              onPointerDown={(day, cellIndex) => {
                dragMoved.current = false;
                setDrag({ day, from: cellIndex, to: cellIndex });
              }}
              onPointerEnter={(day, cellIndex) => {
                setDrag((current) => {
                  if (!current || current.day !== day) return current;
                  if (current.to !== cellIndex) dragMoved.current = true;
                  return { ...current, to: cellIndex };
                });
              }}
            />
          ))}
        </div>
      </div>
      {blocksOnWeek.length > 0 ? (
        <ul className="space-y-1 text-xs text-[var(--pb-ink-soft)]" lang="ja">
          {blocksOnWeek.map((draft) => (
            <li key={`${draft.start}-list`} className="flex items-center justify-between gap-2">
              <span>
                {isRegistered(draft) ? `${t("slotRegistered")} · ` : ""}
                {`${formatTokyoShort(draft.start)}–${formatTokyoShort(draft.end).split(" ")[1] ?? ""}`}
              </span>
              <button
                type="button"
                className="text-[var(--pb-red)]"
                aria-label={t("slotRemoveBlock")}
                onClick={() => onChange(removeDraftSlot(drafts, draft))}
              >
                {t("slotRemoveGlyph")}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
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
  baseline,
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
  baseline: DraftSlot[];
  drag: { day: string; from: number; to: number } | null;
  onPointerDown: (day: string, index: number) => void;
  onPointerEnter: (day: string, index: number) => void;
}) {
  const dragLo = drag ? Math.min(drag.from, drag.to) : -1;
  const dragHi = drag ? Math.max(drag.from, drag.to) : -1;
  return (
    <>
      <div className="bg-[var(--pb-card)] px-1 py-1 text-right text-[11px] leading-[1.75rem] text-[var(--pb-muted)]">
        {cell.label}
      </div>
      {days.map((day) => {
        const range = cellRange(day, cell.hour, cell.minute);
        const hit = occupancyAt(occupancy, range.start, range.end, appId);
        const picked = drafts.some((draft) => draftCoversRange(draft, range));
        const registered =
          picked &&
          baseline.some(
            (base) =>
              draftCoversRange(base, range) &&
              drafts.some((draft) => sameSlot(draft, base)),
          );
        const dragging = drag?.day === day && index >= dragLo && index <= dragHi;
        let className =
          "relative z-0 min-h-[1.75rem] cursor-pointer bg-white";
        if (hit?.kind === "confirmed") {
          className = "min-h-[1.75rem] cursor-not-allowed bg-emerald-700/80";
        } else if (hit?.kind === "proposed") {
          className =
            "min-h-[1.75rem] cursor-not-allowed bg-[repeating-linear-gradient(45deg,#fbbf24,#fbbf24_4px,#fff7ed_4px,#fff7ed_8px)]";
        } else if (hit?.kind === "busy") {
          className = "min-h-[1.75rem] cursor-not-allowed bg-zinc-300";
        } else if (dragging) {
          className = "min-h-[1.75rem] cursor-pointer bg-[var(--pb-teal)]/40";
        } else if (registered) {
          className = "min-h-[1.75rem] cursor-pointer bg-[#e8d9c0]";
        } else if (picked) {
          className = "min-h-[1.75rem] cursor-pointer bg-[var(--pb-teal-soft)]";
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
              if (hit && hit.kind !== "own") return;
              onPointerDown(day, index);
            }}
            onPointerEnter={() => onPointerEnter(day, index)}
          />
        );
      })}
    </>
  );
}
