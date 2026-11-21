"use client";

import type { InterviewPrepRound } from "@/lib/interview-prep/types";

type Props = {
  rounds: InterviewPrepRound[];
  value: string | null;
  onChange: (stageId: string) => void;
  label: string;
  unscheduledHint: string;
  emptyLabel: string;
};

export function RoundSelector({
  rounds,
  value,
  onChange,
  label,
  unscheduledHint,
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
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-[var(--pb-teal-deep)]">{label}</span>
      <select
        className="rounded-lg border border-[var(--pb-line)] bg-[var(--pb-card)] px-3 py-2 text-sm text-[var(--pb-ink)]"
        data-testid="prep-round-select"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
      >
        {rounds.map((round) => (
          <option key={round.stageId} value={round.stageId} lang="ja">
            {round.schedulePending
              ? `${round.label}（${unscheduledHint}）`
              : round.label}
          </option>
        ))}
      </select>
    </label>
  );
}
