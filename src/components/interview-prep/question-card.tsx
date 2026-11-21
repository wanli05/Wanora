"use client";

import { useEffect, useRef, useState } from "react";
import {
  MOCK_ANSWER_DELAY_MS,
  type MockPrepQuestion,
} from "@/lib/interview-prep/mock-pack";

export type AnswerUiState = "idle" | "loading" | "ready" | "error";

type Labels = {
  intent: string;
  points: string;
  expand: string;
  collapse: string;
  generate: string;
  generating: string;
  retry: string;
  regenerate: string;
  sampleHeading: string;
  generateError: string;
  demoBadge: string;
  editAnswer: string;
  finishEdit: string;
  cancelEdit: string;
  draftHeading: string;
  editorHint: string;
  editorPlaceholder: string;
};

type Props = {
  question: MockPrepQuestion;
  labels: Labels;
};

export function QuestionCard({ question, labels }: Props) {
  const [open, setOpen] = useState(false);
  const [answerState, setAnswerState] = useState<AnswerUiState>("idle");
  const [sample, setSample] = useState<string | null>(null);
  /** Committed user draft — independent of Mock sample; React state only. */
  const [draft, setDraft] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editBuffer, setEditBuffer] = useState("");
  const [editSnapshot, setEditSnapshot] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function requestSample() {
    if (answerState === "loading") return;
    setAnswerState("loading");
    // Refresh Mock sample only — never clear or overwrite `draft`.
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      const text = question.sampleAnswer?.trim();
      if (!text) {
        setAnswerState("error");
        return;
      }
      setSample(text);
      setAnswerState("ready");
    }, MOCK_ANSWER_DELAY_MS);
  }

  function startEdit() {
    const seed = draft ?? sample ?? "";
    setEditSnapshot(draft);
    setEditBuffer(seed);
    setEditing(true);
  }

  function finishEdit() {
    setDraft(editBuffer);
    setEditing(false);
    setEditSnapshot(null);
  }

  function cancelEdit() {
    setDraft(editSnapshot);
    setEditing(false);
    setEditBuffer("");
    setEditSnapshot(null);
  }

  const canEdit = Boolean(sample) || draft !== null;

  return (
    <article
      className="border-b border-[var(--pb-line)] py-4 last:border-b-0"
      data-testid={`prep-question-${question.id}`}
      data-answer-state={answerState}
      data-editing={editing ? "true" : "false"}
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
          className="mt-3 space-y-3 text-sm text-[var(--pb-ink-soft)]"
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
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {answerState === "idle" || answerState === "error" ? (
          <button
            type="button"
            className="pb-btn pb-btn-ink pb-btn-sm"
            data-testid={`prep-generate-${question.id}`}
            onClick={requestSample}
          >
            {answerState === "error" ? labels.retry : labels.generate}
          </button>
        ) : null}
        {answerState === "loading" ? (
          <button
            type="button"
            className="pb-btn pb-btn-ink pb-btn-sm"
            disabled
            data-testid={`prep-generate-loading-${question.id}`}
          >
            {labels.generating}
          </button>
        ) : null}
        {answerState === "ready" ? (
          <button
            type="button"
            className="pb-btn pb-btn-ghost pb-btn-sm"
            data-testid={`prep-generate-again-${question.id}`}
            onClick={requestSample}
          >
            {labels.regenerate}
          </button>
        ) : null}
        {answerState === "error" ? (
          <p
            role="alert"
            className="m-0 text-xs text-[var(--pb-red)]"
            data-testid={`prep-generate-error-${question.id}`}
          >
            {labels.generateError}
          </p>
        ) : null}
        {canEdit && !editing ? (
          <button
            type="button"
            className="pb-btn pb-btn-ghost pb-btn-sm"
            data-testid={`prep-edit-${question.id}`}
            onClick={startEdit}
          >
            {labels.editAnswer}
          </button>
        ) : null}
      </div>

      {answerState === "ready" && sample ? (
        <div
          className="mt-3 rounded-lg border border-[var(--pb-line)] bg-[var(--pb-card)] px-3 py-3"
          data-testid={`prep-sample-${question.id}`}
        >
          <p className="m-0 text-xs font-semibold text-[var(--pb-muted)]">
            {labels.sampleHeading}
          </p>
          <p className="mt-2 m-0 whitespace-pre-wrap text-sm leading-relaxed" lang="ja">
            {sample}
          </p>
        </div>
      ) : null}

      {editing ? (
        <div
          className="mt-3 space-y-2"
          data-testid={`prep-editor-${question.id}`}
        >
          <p className="m-0 text-xs text-[var(--pb-amber)]">{labels.editorHint}</p>
          <textarea
            className="min-h-32 w-full rounded-lg border border-[var(--pb-line)] bg-white px-3 py-2 text-sm leading-relaxed text-[var(--pb-ink)]"
            lang="ja"
            value={editBuffer}
            placeholder={labels.editorPlaceholder}
            data-testid={`prep-editor-input-${question.id}`}
            onChange={(event) => setEditBuffer(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="pb-btn pb-btn-ink pb-btn-sm"
              data-testid={`prep-editor-finish-${question.id}`}
              onClick={finishEdit}
            >
              {labels.finishEdit}
            </button>
            <button
              type="button"
              className="pb-btn pb-btn-ghost pb-btn-sm"
              data-testid={`prep-editor-cancel-${question.id}`}
              onClick={cancelEdit}
            >
              {labels.cancelEdit}
            </button>
          </div>
        </div>
      ) : null}

      {!editing && draft !== null ? (
        <div
          className="mt-3 rounded-lg border border-[var(--pb-line)] bg-[var(--pb-teal-soft)]/35 px-3 py-3"
          data-testid={`prep-draft-${question.id}`}
        >
          <p className="m-0 text-xs font-semibold text-[var(--pb-teal-deep)]">
            {labels.draftHeading}
          </p>
          <p className="mt-1 m-0 text-xs text-[var(--pb-amber)]">{labels.editorHint}</p>
          <p
            className="mt-2 m-0 whitespace-pre-wrap text-sm leading-relaxed text-[var(--pb-ink)]"
            lang="ja"
          >
            {draft.trim() ? draft : "—"}
          </p>
        </div>
      ) : null}
    </article>
  );
}
