"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAiAssistOptional } from "@/components/ai-sidebar/ai-assist-context";
import { formatTokyoShort } from "@/lib/progress/tokyo";
import { interviewModeLabel } from "@/lib/progress/next-prep";
import { prepBaseThemes, type PrepBaseTheme } from "@/lib/interview-prep/base-themes";
import { summarizeRoundSchedule } from "@/lib/interview-prep/rounds";
import type { InterviewPrepApplication } from "@/lib/interview-prep/types";
import { QuestionCard, type QuestionCardLabels } from "./question-card";
import { RoundSelector } from "./round-selector";

type Props = {
  application: InterviewPrepApplication;
};

type CustomQuestion = {
  id: string;
  title: string;
  guidance: string;
  answerKind: "text";
};

type ReferStatus = "unused" | "missing" | "unavailable";

export function InterviewPrepPage({ application }: Props) {
  const t = useTranslations("InterviewPrep");
  const assist = useAiAssistOptional();
  const [roundId, setRoundId] = useState<string | null>(
    application.initialRoundId,
  );
  const [aiFocusedQuestionId, setAiFocusedQuestionId] = useState<string | null>(
    null,
  );
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);
  const [draftTitle, setDraftTitle] = useState("");
  const [addHint, setAddHint] = useState<string | null>(null);
  const [aiSuggestError, setAiSuggestError] = useState(false);

  const selected = useMemo(
    () => application.rounds.find((round) => round.stageId === roundId) ?? null,
    [application.rounds, roundId],
  );

  const schedule = summarizeRoundSchedule(selected);
  const scheduleInterview =
    selected?.interviews.find((item) => item.id === schedule.interviewId) ??
    null;

  const baseThemes = prepBaseThemes();

  const questionLabels: QuestionCardLabels = {
    expand: t("expandDetails"),
    collapse: t("collapseDetails"),
    guidanceLabel: t("guidanceLabel"),
    answerHeading: t("answerHeading"),
    openAiAssist: t("openAiAssist"),
    aiAssistHint: t("aiAssistHint"),
    reflectComingSoon: t("reflectComingSoon"),
    editorHint: t("editorHint"),
    editorPlaceholder: t("editorPlaceholder"),
    aiUnavailable: t("aiUnavailable"),
    successLabel: t("successLabel"),
    failureLabel: t("failureLabel"),
    reverseItemLabel: t("reverseItemLabel"),
    addReverseItem: t("addReverseItem"),
    removeReverseItem: t("removeReverseItem"),
    reversePlaceholder: t("reversePlaceholder"),
  };

  function onRoundChange(next: string | null) {
    setRoundId(next);
    setAiFocusedQuestionId(null);
  }

  function addCustomQuestion() {
    const title = draftTitle.trim();
    if (!title) {
      setAddHint(t("customEmptyHint"));
      return;
    }
    const id = `custom-${Date.now()}`;
    setCustomQuestions((prev) => [
      ...prev,
      {
        id,
        title,
        guidance: t("customGuidance"),
        answerKind: "text",
      },
    ]);
    setDraftTitle("");
    setAddHint(t("customDemoHint"));
  }

  function removeCustomQuestion(id: string) {
    setCustomQuestions((prev) => prev.filter((item) => item.id !== id));
    if (aiFocusedQuestionId === id) {
      setAiFocusedQuestionId(null);
    }
  }

  async function openAiSuggest() {
    setAiFocusedQuestionId("custom-suggest");
    if (!assist) {
      setAiSuggestError(true);
      return;
    }
    const ok = await assist.openPanel();
    setAiSuggestError(!ok);
  }

  const referRows: { key: string; label: string; status: ReferStatus }[] = [
    { key: "career", label: t("referCareer"), status: "unused" },
    { key: "job", label: t("referJob"), status: "unused" },
    { key: "company", label: t("referCompany"), status: "unused" },
    { key: "history", label: t("referHistory"), status: "unused" },
  ];

  function referStatusLabel(status: ReferStatus) {
    if (status === "missing") return t("referStatusMissing");
    if (status === "unavailable") return t("referStatusUnavailable");
    return t("referStatusUnused");
  }

  return (
    <main
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 lg:max-w-6xl"
      data-testid="interview-prep-page"
    >
      <div className="pb-shell overflow-hidden rounded-2xl border border-[#cfdad3] p-4 sm:p-6 lg:p-8">
        <header className="mb-5 border-b border-[var(--pb-line)] pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link
                href="/progress"
                className="pb-btn pb-btn-ghost pb-btn-sm mb-3 inline-flex"
                data-testid="prep-back"
              >
                {t("backToBoard")}
              </Link>
              <p className="m-0 text-xs font-semibold tracking-wide text-[var(--pb-muted)]">
                {t("title")}
              </p>
              <h1
                className="mt-1 text-xl font-semibold leading-snug text-[var(--pb-teal-deep)] sm:text-2xl"
                lang="ja"
                data-testid="prep-company"
              >
                {application.company}
              </h1>
              <p
                className="mt-1 m-0 text-sm text-[var(--pb-ink-soft)]"
                lang="ja"
                data-testid="prep-role"
              >
                {application.role?.trim() ? application.role : t("roleUnset")}
              </p>
            </div>
          </div>
        </header>

        <section
          className="mb-5 grid gap-3 rounded-xl border border-[var(--pb-line)] bg-[var(--pb-card)] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:items-end sm:gap-4 sm:p-4"
          data-testid="prep-meta"
        >
          <RoundSelector
            rounds={application.rounds}
            value={roundId}
            onChange={onRoundChange}
            label={t("roundLabel")}
            unscheduledHint={t("scheduleUnscheduled")}
            emptyLabel={t("noInterviewStages")}
          />

          <div
            className="rounded-lg border border-[var(--pb-line)] bg-white px-3 py-2.5 text-sm"
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
            <p className="mt-1 m-0 text-xs leading-relaxed text-[var(--pb-muted)]">
              {t("scheduleHint")}
            </p>
          </div>
        </section>

        <p
          className="mb-4 m-0 rounded-lg border border-[var(--pb-line)] px-3 py-2 text-xs leading-relaxed text-[var(--pb-ink-soft)]"
          data-testid="prep-demo-notice"
        >
          <span>{t("demoNotice")}</span>{" "}
          <span className="text-[var(--pb-amber)]" data-testid="prep-round-switch-hint">
            {t("roundSwitchHint")}
          </span>
        </p>

        <section
          className="mb-5 rounded-xl border border-[var(--pb-line)] bg-[var(--pb-card)] px-4 py-3 sm:px-5"
          data-testid="prep-refer-info"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="m-0 text-sm font-semibold text-[var(--pb-teal-deep)]">
              {t("referHeading")}
            </h2>
            <p className="m-0 text-xs text-[var(--pb-muted)]">{t("referHint")}</p>
          </div>
          <ul className="mt-3 mb-0 grid list-none gap-x-6 gap-y-2 p-0 sm:grid-cols-2">
            {referRows.map((row) => (
              <li
                key={row.key}
                className="flex items-center justify-between gap-2 text-sm"
                data-testid={`prep-refer-${row.key}`}
                data-status={row.status}
              >
                <span lang="ja">{row.label}</span>
                <span className="shrink-0 text-xs text-[var(--pb-muted)]">
                  {referStatusLabel(row.status)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="mb-5 rounded-xl border border-[var(--pb-line)] bg-[var(--pb-card)] px-4 py-2 sm:px-5"
          data-testid="prep-questions"
          data-stage-kind={selected?.stageKind ?? "fallback"}
          data-ai-focused-question={aiFocusedQuestionId ?? ""}
          data-base-count={baseThemes.length}
        >
          <h2 className="m-0 border-b border-[var(--pb-line)] py-3 text-sm font-semibold text-[var(--pb-teal-deep)]">
            {t("baseQuestionsHeading")}
          </h2>
          {baseThemes.map((theme) => (
            <QuestionCard
              key={`${selected?.stageId ?? "none"}:${theme.id}`}
              theme={theme}
              labels={questionLabels}
              aiFocused={aiFocusedQuestionId === theme.id}
              onAiFocus={setAiFocusedQuestionId}
            />
          ))}
        </section>

        <section
          className="rounded-xl border border-[var(--pb-line)] bg-[var(--pb-card)] px-4 py-3 sm:px-5"
          data-testid="prep-custom-questions"
        >
          <h2 className="m-0 text-sm font-semibold text-[var(--pb-teal-deep)]">
            {t("customQuestionsHeading")}
          </h2>
          <p className="mt-1 m-0 text-xs text-[var(--pb-muted)]">
            {t("customQuestionsHint")}
          </p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              className="w-full flex-1 rounded-lg border border-[var(--pb-line)] bg-white px-3 py-2 text-sm"
              lang="ja"
              value={draftTitle}
              placeholder={t("customInputPlaceholder")}
              data-testid="prep-custom-input"
              onChange={(event) => setDraftTitle(event.target.value)}
            />
            <button
              type="button"
              className="pb-btn pb-btn-ink pb-btn-sm shrink-0"
              data-testid="prep-custom-add"
              onClick={addCustomQuestion}
            >
              {t("addQuestion")}
            </button>
            <button
              type="button"
              className="pb-btn pb-btn-ghost pb-btn-sm shrink-0"
              data-testid="prep-custom-ai-suggest"
              onClick={() => {
                void openAiSuggest();
              }}
            >
              {t("aiSuggestQuestions")}
            </button>
          </div>
          {addHint ? (
            <p
              className="mt-2 m-0 text-xs text-[var(--pb-amber)]"
              data-testid="prep-custom-demo-hint"
            >
              {addHint}
            </p>
          ) : null}
          <p className="mt-2 m-0 text-xs text-[var(--pb-muted)]">
            {t("aiSuggestPending")}
          </p>
          {aiSuggestError || assist?.bridgeError === "ai_unavailable" ? (
            <p
              role="alert"
              className="mt-2 m-0 text-xs text-[var(--pb-red)]"
              data-testid="prep-custom-ai-unavailable"
            >
              {t("aiUnavailable")}
            </p>
          ) : null}

          {customQuestions.length === 0 ? (
            <p
              className="mt-3 m-0 text-sm text-[var(--pb-muted)]"
              data-testid="prep-custom-empty"
            >
              {t("customEmpty")}
            </p>
          ) : (
            customQuestions.map((item) => {
              const theme: PrepBaseTheme = {
                id: item.id,
                title: item.title,
                guidance: item.guidance,
                answerKind: "text",
              };
              return (
                <QuestionCard
                  key={`${selected?.stageId ?? "none"}:${item.id}`}
                  theme={theme}
                  labels={questionLabels}
                  aiFocused={aiFocusedQuestionId === item.id}
                  onAiFocus={setAiFocusedQuestionId}
                  removeLabel={t("removeCustomQuestion")}
                  onRemove={() => removeCustomQuestion(item.id)}
                />
              );
            })
          )}
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
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6 lg:max-w-6xl"
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
          href={kind === "signed_out" ? "/sign-in" : "/progress"}
          className="pb-btn pb-btn-ink pb-btn-sm mt-4 inline-flex"
          data-testid="prep-fallback-link"
        >
          {kind === "signed_out" ? t("goSignIn") : t("backToBoard")}
        </Link>
      </div>
    </main>
  );
}
