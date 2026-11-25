"use client";

import { useState } from "react";
import { useAiAssistOptional } from "@/components/ai-sidebar/ai-assist-context";
import type { PrepBaseTheme } from "@/lib/interview-prep/base-themes";

export type QuestionCardLabels = {
  expand: string;
  collapse: string;
  guidanceLabel: string;
  answerHeading: string;
  openAiAssist: string;
  aiAssistHint: string;
  reflectComingSoon: string;
  editorHint: string;
  editorPlaceholder: string;
  aiUnavailable: string;
  successLabel: string;
  failureLabel: string;
  reverseItemLabel: string;
  addReverseItem: string;
  removeReverseItem: string;
  reversePlaceholder: string;
};

type Props = {
  theme: PrepBaseTheme;
  labels: QuestionCardLabels;
  onAiFocus?: (questionId: string) => void;
  aiFocused?: boolean;
};

/**
 * Base / custom prep question card.
 * Answer state is React-only (demo). AI entry uses openPanel only.
 */
export function QuestionCard({
  theme,
  labels,
  onAiFocus,
  aiFocused = false,
}: Props) {
  const assist = useAiAssistOptional();
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [successAnswer, setSuccessAnswer] = useState("");
  const [failureAnswer, setFailureAnswer] = useState("");
  const [reverseItems, setReverseItems] = useState<string[]>([""]);
  const [aiError, setAiError] = useState(false);

  async function openAiAssist() {
    onAiFocus?.(theme.id);
    if (!assist) {
      setAiError(true);
      return;
    }
    const ok = await assist.openPanel();
    setAiError(!ok);
  }

  return (
    <article
      className="border-b border-[var(--pb-line)] py-3 last:border-b-0"
      data-testid={`prep-question-${theme.id}`}
      data-answer-kind={theme.answerKind}
      data-ai-focused={aiFocused ? "true" : "false"}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3
          className="m-0 flex-1 text-sm font-semibold text-[var(--pb-ink)]"
          lang="ja"
        >
          {theme.title}
        </h3>
        <button
          type="button"
          className="pb-btn pb-btn-ghost pb-btn-sm shrink-0"
          data-testid={`prep-question-toggle-${theme.id}`}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? labels.collapse : labels.expand}
        </button>
      </div>

      {open ? (
        <div
          className="mt-3 space-y-3 text-sm text-[var(--pb-ink-soft)]"
          data-testid={`prep-question-details-${theme.id}`}
        >
          <div>
            <p className="m-0 text-xs font-semibold text-[var(--pb-teal-deep)]">
              {labels.guidanceLabel}
            </p>
            <p className="mt-1 m-0" lang="ja">
              {theme.guidance}
            </p>
          </div>

          <div
            className="space-y-2 rounded-xl border border-[var(--pb-line)] bg-[var(--pb-card)] px-3 py-3"
            data-testid={`prep-answer-section-${theme.id}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 text-xs font-semibold text-[var(--pb-teal-deep)]">
                {labels.answerHeading}
              </p>
              <button
                type="button"
                className="pb-btn pb-btn-ink pb-btn-sm"
                data-testid={`prep-ai-assist-${theme.id}`}
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
                data-testid={`prep-ai-unavailable-${theme.id}`}
              >
                {labels.aiUnavailable}
              </p>
            ) : null}
            <p className="m-0 text-xs text-[var(--pb-amber)]">{labels.editorHint}</p>

            {theme.answerKind === "text" ? (
              <textarea
                className="min-h-28 w-full resize-y rounded-lg border border-[var(--pb-line)] bg-white px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap text-[var(--pb-ink)]"
                lang="ja"
                value={answer}
                placeholder={labels.editorPlaceholder}
                data-testid={`prep-editor-input-${theme.id}`}
                onChange={(event) => setAnswer(event.target.value)}
              />
            ) : null}

            {theme.answerKind === "dual_experience" ? (
              <div className="space-y-3" data-testid={`prep-dual-${theme.id}`}>
                <div>
                  <p className="m-0 mb-1 text-xs font-semibold text-[var(--pb-ink)]">
                    {labels.successLabel}
                  </p>
                  <textarea
                    className="min-h-24 w-full resize-y rounded-lg border border-[var(--pb-line)] bg-white px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap text-[var(--pb-ink)]"
                    lang="ja"
                    value={successAnswer}
                    placeholder={labels.editorPlaceholder}
                    data-testid={`prep-editor-success-${theme.id}`}
                    onChange={(event) => setSuccessAnswer(event.target.value)}
                  />
                </div>
                <div>
                  <p className="m-0 mb-1 text-xs font-semibold text-[var(--pb-ink)]">
                    {labels.failureLabel}
                  </p>
                  <textarea
                    className="min-h-24 w-full resize-y rounded-lg border border-[var(--pb-line)] bg-white px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap text-[var(--pb-ink)]"
                    lang="ja"
                    value={failureAnswer}
                    placeholder={labels.editorPlaceholder}
                    data-testid={`prep-editor-failure-${theme.id}`}
                    onChange={(event) => setFailureAnswer(event.target.value)}
                  />
                </div>
              </div>
            ) : null}

            {theme.answerKind === "reverse_qa_list" ? (
              <div className="space-y-2" data-testid={`prep-reverse-list-${theme.id}`}>
                {reverseItems.map((item, index) => (
                  <div
                    key={`rev-${index}`}
                    className="flex flex-col gap-1 sm:flex-row sm:items-start"
                  >
                    <label className="sr-only" htmlFor={`prep-rev-${theme.id}-${index}`}>
                      {labels.reverseItemLabel} {index + 1}
                    </label>
                    <input
                      id={`prep-rev-${theme.id}-${index}`}
                      className="w-full flex-1 rounded-lg border border-[var(--pb-line)] bg-white px-3 py-2 text-sm text-[var(--pb-ink)]"
                      lang="ja"
                      value={item}
                      placeholder={labels.reversePlaceholder}
                      data-testid={`prep-reverse-item-${theme.id}-${index}`}
                      onChange={(event) => {
                        const next = [...reverseItems];
                        next[index] = event.target.value;
                        setReverseItems(next);
                      }}
                    />
                    <button
                      type="button"
                      className="pb-btn pb-btn-ghost pb-btn-sm shrink-0"
                      data-testid={`prep-reverse-remove-${theme.id}-${index}`}
                      disabled={reverseItems.length <= 1}
                      onClick={() => {
                        if (reverseItems.length <= 1) return;
                        setReverseItems(reverseItems.filter((_, i) => i !== index));
                      }}
                    >
                      {labels.removeReverseItem}
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="pb-btn pb-btn-ghost pb-btn-sm"
                  data-testid={`prep-reverse-add-${theme.id}`}
                  onClick={() => setReverseItems([...reverseItems, ""])}
                >
                  {labels.addReverseItem}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
