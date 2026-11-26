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
  const ignoreNextCommit = useRef(false);
  const days = useMemo(() => weekDateKeys(monday), [monday]);
  const starts = slotStarts();

  function conflictText(kind: string | undefined) {
    if (kind === "confirmed") return t("slotConflictConfirmed");
    if (kind === "busy") return t("slotConflictBusy");
    if (kind === "own") return t("slotSelfOverlap");
    return t("slotConflictProposed");
  }

  function commitDrag(day: string, from: number, to: number) {
    if (ignoreNextCommit.current) {
      ignoreNextCommit.current = false;
      return;
    }
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
    <div data-testid="slot-grid" className="flex min-h-0 flex-1 flex-col gap-2">
      <p className="text-xs text-[var(--pb-muted)]">
        {t("slotGridHint")}
        <span lang="ja">{` ${company}`}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
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
      <div className="flex items-center justify-between text-xs">
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
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
        data-testid="slot-grid-scroll"
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
          ignoreNextCommit.current = false;
        }}
      >
        {/*
          Fit time axis + 7 days inside ~480px drawer content width
          (no min-width horizontal scroll at 1536×1024).
        */}
        <div
          className="pb-slot-week-grid relative grid w-full grid-cols-[2rem_repeat(7,minmax(0,1fr))] gap-px rounded-lg border border-[var(--pb-line)] bg-[var(--pb-line)]"
          data-testid="slot-week-grid"
        >
          <div className="bg-[var(--pb-card)]" />
          {days.map((day, index) => (
            <div
              key={day}
              className="bg-[var(--pb-card)] px-0.5 py-1 text-center text-[10px] font-medium leading-tight"
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
          {blocksOnWeek.map((draft) => (
            <DraftBlockChrome
              key={`${draft.start}-${draft.end}`}
              draft={draft}
              days={days}
              starts={starts}
              registered={isRegistered(draft)}
              registeredLabel={t("slotRegistered")}
              removeLabel={t("slotRemoveBlock")}
              removeGlyph={t("slotRemoveGlyph")}
              onRemove={() => {
                ignoreNextCommit.current = true;
                setDrag(null);
                dragMoved.current = false;
                onChange(removeDraftSlot(drafts, draft));
              }}
            />
          ))}
        </div>
      </div>
      {blocksOnWeek.length > 0 ? (
        <ul className="space-y-1 text-[11px] text-[var(--pb-ink-soft)]" lang="ja">
          {blocksOnWeek.map((draft) => (
            <li key={`${draft.start}-list`} data-testid={`slot-block-list-${draft.start}`}>
              {isRegistered(draft) ? `${t("slotRegistered")} · ` : ""}
              {`${formatTokyoShort(draft.start)}–${formatTokyoShort(draft.end).split(" ")[1] ?? ""}`}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DraftBlockChrome({
  draft,
  days,
  starts,
  registered,
  registeredLabel,
  removeLabel,
  removeGlyph,
  onRemove,
}: {
  draft: DraftSlot;
  days: string[];
  starts: { hour: number; minute: number; label: string }[];
  registered: boolean;
  registeredLabel: string;
  removeLabel: string;
  removeGlyph: string;
  onRemove: () => void;
}) {
  const dayIndex = days.findIndex((day) => {
    const dayStart = `${day}T00:00:00+09:00`;
    const dayEnd = `${day}T23:59:59+09:00`;
    return draftOverlapsRange(draft, { start: dayStart, end: dayEnd });
  });
  if (dayIndex < 0) return null;
  const day = days[dayIndex]!;
  let first = -1;
  let last = -1;
  starts.forEach((cell, index) => {
    const range = cellRange(day, cell.hour, cell.minute);
    if (draftOverlapsRange(draft, range)) {
      if (first < 0) first = index;
      last = index;
    }
  });
  if (first < 0 || last < 0) return null;
  // Header row is 1; time rows start at 2.
  const gridColumn = dayIndex + 2;
  const gridRowStart = first + 2;
  const gridRowEnd = last + 3;
  return (
    <div
      className={`pointer-events-none z-[2] m-px flex flex-col justify-between rounded-sm px-0.5 py-0.5 text-[9px] font-semibold leading-tight ${
        registered
          ? "bg-[#d9c4a0]/95 text-[#4a3b28]"
          : "bg-[var(--pb-teal)]/90 text-white"
      }`}
      style={{
        gridColumn,
        gridRow: `${gridRowStart} / ${gridRowEnd}`,
      }}
      data-testid={`slot-block-${draft.start}`}
      data-registered={registered ? "true" : "false"}
    >
      <span className="truncate">{registered ? registeredLabel : ""}</span>
      <button
        type="button"
        className="pointer-events-auto self-end rounded px-0.5 text-[11px] leading-none"
        data-testid={`slot-block-remove-${draft.start}`}
        aria-label={removeLabel}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onRemove();
        }}
      >
        {removeGlyph}
      </button>
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
      <div className="bg-[var(--pb-card)] px-0.5 py-0 text-right text-[9px] leading-[1.5rem] text-[var(--pb-muted)]">
        {cell.minute === 0 ? cell.label : ""}
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
          "relative z-0 min-h-[1.5rem] cursor-pointer bg-white";
        if (hit?.kind === "confirmed") {
          className = "min-h-[1.5rem] cursor-not-allowed bg-emerald-700/80";
        } else if (hit?.kind === "proposed") {
          className =
            "min-h-[1.5rem] cursor-not-allowed bg-[repeating-linear-gradient(45deg,#fbbf24,#fbbf24_4px,#fff7ed_4px,#fff7ed_8px)]";
        } else if (hit?.kind === "busy") {
          className = "min-h-[1.5rem] cursor-not-allowed bg-zinc-300";
        } else if (dragging) {
          className = "min-h-[1.5rem] cursor-pointer bg-[var(--pb-teal)]/40";
        } else if (registered) {
          className = "min-h-[1.5rem] cursor-pointer bg-[#e8d9c0]";
        } else if (picked) {
          className = "min-h-[1.5rem] cursor-pointer bg-[var(--pb-teal-soft)]";
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
