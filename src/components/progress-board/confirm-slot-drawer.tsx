"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { BoardApplication, BoardSlot } from "@/lib/progress/dto";
import { initialConfirmSlotId } from "@/lib/progress/confirm-slot-selection";
import {
  formatTokyoDate,
  formatTokyoShort,
  tokyoDateKey,
} from "@/lib/progress/tokyo";

const WEEKDAY_KEYS = [
  "calSun",
  "calMon",
  "calTue",
  "calWed",
  "calThu",
  "calFri",
  "calSat",
] as const;

function weekdayKey(iso: string): (typeof WEEKDAY_KEYS)[number] {
  const key = tokyoDateKey(iso);
  const noon = new Date(`${key}T12:00:00+09:00`);
  return WEEKDAY_KEYS[noon.getUTCDay()] ?? "calMon";
}

function timeRange(start: string, end: string): string {
  const startLabel = formatTokyoShort(start).split(" ")[1] ?? "";
  const endLabel = formatTokyoShort(end).split(" ")[1] ?? "";
  return `${startLabel} - ${endLabel}`;
}

export function ConfirmSlotDrawer({
  app,
  slots,
  currentInterview,
  busy,
  error,
  onConfirm,
  onClose,
  onEditSlots,
}: {
  app: BoardApplication;
  slots: BoardSlot[];
  currentInterview?: { start: string; end: string } | null;
  busy?: boolean;
  error?: string | null;
  onConfirm: (slotId: string) => void;
  onClose: () => void;
  onEditSlots?: () => void;
}) {
  const t = useTranslations("Board");
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    initialConfirmSlotId(slots, currentInterview),
  );

  const groups = useMemo(() => {
    const map = new Map<string, BoardSlot[]>();
    const sorted = [...slots].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
    );
    for (const slot of sorted) {
      const key = tokyoDateKey(slot.start);
      const list = map.get(key) ?? [];
      list.push(slot);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [slots]);

  const selected = slots.find((slot) => slot.id === selectedId) ?? null;

  return (
    <aside
      className="pb-schedule-drawer pb-schedule-drawer--confirm"
      data-testid="confirm-slot-drawer"
      role="dialog"
      aria-modal="true"
      aria-label={t("confirmInterviewTitle")}
    >
      <header className="pb-schedule-drawer-head">
        <div>
          <h2 className="m-0 text-base font-bold text-[var(--pb-teal-deep)]">
            {t("confirmInterviewTitle")}
          </h2>
          <p className="m-0 mt-0.5 text-sm text-[var(--pb-muted)]" lang="ja">
            {app.company}
          </p>
        </div>
        <button
          type="button"
          className="text-lg leading-none text-[var(--pb-muted)]"
          aria-label={t("cancel")}
          onClick={onClose}
        >
          {t("drawerClose")}
        </button>
      </header>

      <div className="pb-schedule-drawer-body">
        <p className="m-0 text-sm text-[var(--pb-ink-soft)]">
          {t("confirmInterviewHint")}
        </p>
        {currentInterview ? (
          <div
            className="mt-3 rounded-lg border border-[var(--pb-line)] bg-[var(--pb-teal-soft)]/50 px-3 py-2 text-sm"
            data-testid="confirm-current-interview"
          >
            <div className="text-[11px] font-semibold text-[var(--pb-muted)]">
              {t("confirmCurrentTime")}
            </div>
            <div lang="ja">
              {`${formatTokyoDate(currentInterview.start)} (${t(weekdayKey(currentInterview.start))}) ${timeRange(currentInterview.start, currentInterview.end)}`}
            </div>
          </div>
        ) : null}

        <div className="mt-4 space-y-4">
          {groups.map(([dateKey, daySlots]) => (
            <section key={dateKey}>
              <h3 className="m-0 mb-2 text-sm font-bold text-[var(--pb-ink)]">
                {`${formatTokyoDate(daySlots[0]!.start)} (${t(weekdayKey(daySlots[0]!.start))})`}
              </h3>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {daySlots.map((slot) => {
                  const checked = selectedId === slot.id;
                  return (
                    <li key={slot.id}>
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                          checked
                            ? "border-[var(--pb-teal)] bg-[var(--pb-teal-soft)]"
                            : "border-[var(--pb-line)] bg-white"
                        }`}
                      >
                        <input
                          type="radio"
                          name="confirm-slot"
                          className="accent-[var(--pb-teal)]"
                          checked={checked}
                          onChange={() => setSelectedId(slot.id)}
                          data-testid={`confirm-slot-radio-${slot.id}`}
                        />
                        <span lang="ja">{timeRange(slot.start, slot.end)}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        {onEditSlots ? (
          <button
            type="button"
            className="mt-4 text-sm font-semibold text-[var(--pb-teal-deep)] underline"
            onClick={onEditSlots}
          >
            {t("editCandidateSlots")}
          </button>
        ) : null}
      </div>

      <footer className="pb-schedule-drawer-foot">
        {selected ? (
          <div
            className="mb-3 rounded-lg border border-[var(--pb-line)] bg-[var(--pb-teal-soft)] px-3 py-2"
            data-testid="confirm-selected-preview"
          >
            <div className="text-[11px] font-semibold text-[var(--pb-muted)]">
              {t("confirmSelectedLabel")}
            </div>
            <div className="text-sm font-semibold text-[var(--pb-teal-deep)]" lang="ja">
              {`${formatTokyoDate(selected.start)} (${t(weekdayKey(selected.start))}) ${timeRange(selected.start, selected.end)}`}
            </div>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="mb-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          className="pb-btn w-full"
          disabled={!selected || busy}
          data-testid="confirm-slot-submit"
          onClick={() => {
            if (selected) onConfirm(selected.id);
          }}
        >
          {t("confirmSelectedSubmit")}
        </button>
      </footer>
    </aside>
  );
}
