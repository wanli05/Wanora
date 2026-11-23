"use client";

import { useState } from "react";
import { useAiAssistOptional } from "@/components/ai-sidebar/ai-assist-context";
import type { MockPrepQuestion } from "@/lib/interview-prep/mock-pack";

type Labels = {
  intent: string;
  points: string;
  expand: string;
  collapse: string;
  demoBadge: string;
  answerHeading: string;
  openAiAssist: string;
  aiAssistHint: string;
  reflectComingSoon: string;
  editorHint: string;
  editorPlaceholder: string;
  aiUnavailable: string;
};

type Props = {
  question: MockPrepQuestion;
  labels: Labels;
  /** Fired when the user opens AI for this question (Phase 2C will bind sessions). */
  onAiFocus?: (questionId: string) => void;
  /** Whether this card is the last focused AI target on the page. */
  aiFocused?: boolean;
};

/**
 * Interview-prep question card (PR-C UI redesign).
 * Answer editing is React-state only; AI entry opens the shared sidebar without
 * claiming Application Context or auto-sending jobs.
 */
export function QuestionCard({
  question,
  labels,
  onAiFocus,
  aiFocused = false,
}: Props) {
  const assist = useAiAssistOptional();
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [aiError, setAiError] = useState(false);

  async function openAiAssist() {
    onAiFocus?.(question.id);
    if (!assist) {
      setAiError(true);
      return;
    }
    const ok = await assist.openPanel();
    setAiError(!ok);
  }

  return (
    <article
      className="border-b border-[var(--pb-line)] py-4 last:border-b-0"
      data-testid={`prep-question-${question.id}`}
      data-ai-focused={aiFocused ? "true" : "false"}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3
          className="m-0 flex-1 text-sm font-semibold text-[var(--pb-ink)]"
          lang="ja"
        >
          <span className="mr-2 inline-block rounded bg-[var(--pb-teal-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--pb-teal-deep)]">
            {labels.demoBadge}
          </span>
          {question.question}
        </h3>
        <button
          type="button"
          className="pb-btn pb-btn-ghost pb-btn-sm shrink-0"
          data-testid={`prep-question-toggle-${question.id}`}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? labels.collapse : labels.expand}
        </button>
      </div>

      {open ? (
        <div
          className="mt-3 space-y-4 text-sm text-[var(--pb-ink-soft)]"
          data-testid={`prep-question-details-${question.id}`}
        >
          <div>
            <p className="m-0 text-xs font-semibold text-[var(--pb-teal-deep)]">
              {labels.intent}
            </p>
            <p className="mt-1 m-0" lang="ja">
              {question.intent}
            </p>
          </div>
          <div>
            <p className="m-0 text-xs font-semibold text-[var(--pb-teal-deep)]">
              {labels.points}
            </p>
            <ul className="mt-1 mb-0 list-disc space-y-1 pl-5" lang="ja">
              {question.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>

          <div
            className="space-y-2 rounded-xl border border-[var(--pb-line)] bg-[var(--pb-card)] px-3 py-3"
            data-testid={`prep-answer-section-${question.id}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 text-xs font-semibold text-[var(--pb-teal-deep)]">
                {labels.answerHeading}
              </p>
              <button
                type="button"
                className="pb-btn pb-btn-ink pb-btn-sm"
                data-testid={`prep-ai-assist-${question.id}`}
                onClick={() => {
                  void openAiAssist();
                }}
              >
                {labels.openAiAssist}
              </button>
            </div>
            <p className="m-0 text-xs text-[var(--pb-muted)]">{labels.aiAssistHint}</p>
            <p className="m-0 text-xs text-[var(--pb-muted)]">
              {labels.reflectComingSoon}
            </p>
            {aiError || assist?.bridgeError === "ai_unavailable" ? (
              <p
                role="alert"
                className="m-0 text-xs text-[var(--pb-red)]"
                data-testid={`prep-ai-unavailable-${question.id}`}
              >
                {labels.aiUnavailable}
              </p>
            ) : null}
            <p className="m-0 text-xs text-[var(--pb-amber)]">{labels.editorHint}</p>
            <textarea
              className="min-h-32 w-full resize-y rounded-lg border border-[var(--pb-line)] bg-white px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap text-[var(--pb-ink)]"
              lang="ja"
              value={answer}
              placeholder={labels.editorPlaceholder}
              data-testid={`prep-editor-input-${question.id}`}
              onChange={(event) => setAnswer(event.target.value)}
            />
          </div>
        </div>
      ) : null}
    </article>
  );
}
