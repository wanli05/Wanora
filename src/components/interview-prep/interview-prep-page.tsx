"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatTokyoShort } from "@/lib/progress/tokyo";
import { interviewModeLabel } from "@/lib/progress/next-prep";
import { summarizeRoundSchedule } from "@/lib/interview-prep/rounds";
import type { InterviewPrepApplication } from "@/lib/interview-prep/types";
import { RoundSelector } from "./round-selector";

type Props = {
  application: InterviewPrepApplication;
};

export function InterviewPrepPage({ application }: Props) {
  const t = useTranslations("InterviewPrep");
  const [roundId, setRoundId] = useState<string | null>(
    application.initialRoundId,
  );

  const selected = useMemo(
    () => application.rounds.find((round) => round.stageId === roundId) ?? null,
    [application.rounds, roundId],
  );

  const schedule = summarizeRoundSchedule(selected);
  const scheduleInterview =
    selected?.interviews.find((item) => item.id === schedule.interviewId) ??
    null;

  return (
    <main
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6"
      data-testid="interview-prep-page"
    >
      <div className="pb-shell overflow-hidden rounded-2xl border border-[#cfdad3] p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/"
            className="pb-btn pb-btn-ghost pb-btn-sm"
            data-testid="prep-back"
          >
            {t("backToBoard")}
          </Link>
        </div>

        <header className="mb-5">
          <p className="m-0 text-xs font-semibold tracking-wide text-[var(--pb-muted)]">
            {t("title")}
          </p>
          <h1
            className="mt-1 text-2xl font-semibold text-[var(--pb-teal-deep)]"
            lang="ja"
            data-testid="prep-company"
          >
            {application.company}
          </h1>
          <p
            className="mt-1 text-sm text-[var(--pb-ink-soft)]"
            lang="ja"
            data-testid="prep-role"
          >
            {application.role?.trim() ? application.role : t("roleUnset")}
          </p>
        </header>

        <section className="mb-5 flex flex-col gap-3">
          <RoundSelector
            rounds={application.rounds}
            value={roundId}
            onChange={setRoundId}
            label={t("roundLabel")}
            unscheduledHint={t("scheduleUnscheduled")}
            emptyLabel={t("noInterviewStages")}
          />

          <div
            className="rounded-xl border border-[var(--pb-line)] bg-[var(--pb-card)] px-3 py-3 text-sm"
            data-testid="prep-schedule-status"
          >
            {schedule.kind === "unscheduled" ? (
              <p className="m-0 font-medium text-[var(--pb-amber)]">
                {t("scheduleUnscheduled")}
              </p>
            ) : scheduleInterview ? (
              <p className="m-0 text-[var(--pb-ink-soft)]" lang="ja">
                {t("scheduleKnown", {
                  when: formatTokyoShort(scheduleInterview.start),
                  mode:
                    interviewModeLabel(scheduleInterview.mode) ||
                    scheduleInterview.mode,
                })}
              </p>
            ) : (
              <p className="m-0 font-medium text-[var(--pb-amber)]">
                {t("scheduleUnscheduled")}
              </p>
            )}
            <p className="mt-1 m-0 text-xs text-[var(--pb-muted)]">
              {t("scheduleHint")}
            </p>
          </div>
        </section>

        <section
          className="rounded-xl border border-dashed border-[var(--pb-line)] bg-[var(--pb-teal-soft)]/40 px-4 py-5"
          data-testid="prep-questions-placeholder"
        >
          <p className="m-0 text-sm font-medium text-[var(--pb-teal-deep)]">
            {t("questionsComing")}
          </p>
          <p className="mt-2 m-0 text-xs text-[var(--pb-muted)]">
            {t("demoNotice")}
          </p>
        </section>
      </div>
    </main>
  );
}

type ShellProps = {
  kind: "not_found" | "signed_out";
};

export function InterviewPrepUnavailable({ kind }: ShellProps) {
  const t = useTranslations("InterviewPrep");
  return (
    <main
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6"
      data-testid={
        kind === "not_found" ? "interview-prep-not-found" : "interview-prep-signed-out"
      }
    >
      <div className="rounded-2xl border border-[#cfdad3] bg-[#fffdf8] p-6">
        <h1 className="m-0 text-xl font-semibold text-[#084f49]">
          {kind === "not_found" ? t("notFoundTitle") : t("signedOutTitle")}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          {kind === "not_found" ? t("notFoundBody") : t("signedOutBody")}
        </p>
        <Link
          href={kind === "signed_out" ? "/sign-in" : "/"}
          className="pb-btn pb-btn-ink pb-btn-sm mt-4 inline-flex"
          data-testid="prep-fallback-link"
        >
          {kind === "signed_out" ? t("goSignIn") : t("backToBoard")}
        </Link>
      </div>
    </main>
  );
}
