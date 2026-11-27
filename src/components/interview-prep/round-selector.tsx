"use client";

import type { InterviewPrepRound } from "@/lib/interview-prep/types";

type Props = {
  rounds: InterviewPrepRound[];
  value: string | null;
  onChange: (stageId: string) => void;
  label: string;
  emptyLabel: string;
};

/**
 * Round picker — option text is the round label only (no schedule suffix).
 */
export function RoundSelector({
  rounds,
  value,
  onChange,
  label,
  emptyLabel,
}: Props) {
  if (rounds.length === 0) {
    return (
      <p className="text-sm text-[var(--pb-muted)]" data-testid="prep-round-empty">
        {emptyLabel}
      </p>
    );
  }

  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm">
      <span className="text-xs font-medium text-[var(--pb-muted)]">{label}</span>
      <select
        className="w-full rounded-lg border border-[var(--pb-line)] bg-white px-3 py-2 text-sm text-[var(--pb-ink)]"
        data-testid="prep-round-select"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
      >
        {rounds.map((round) => (
          <option key={round.stageId} value={round.stageId} lang="ja">
            {round.label}
          </option>
        ))}
      </select>
    </label>
  );
}
