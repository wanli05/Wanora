"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useId,
  useState,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import { APP_VERSION } from "@/lib/app-version";
import type {
  ReportIssueContext,
  SupportCategory,
} from "@/lib/support/types";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Prefill when opened from a system error. */
  context?: ReportIssueContext | null;
  /** Default category when no context. */
  defaultCategory?: SupportCategory;
};

type SubmitState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "success"; acceptanceNumber: string }
  | { kind: "error"; message: string; offline?: boolean };

function newSubmissionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sub_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function ReportIssueForm({
  context,
  defaultCategory,
  onClose,
}: {
  context?: ReportIssueContext | null;
  defaultCategory: SupportCategory;
  onClose: () => void;
}) {
  const t = useTranslations("Support");
  const locale = useLocale();
  const titleId = useId();
  const [category, setCategory] = useState<SupportCategory>(
    context ? "bug_report" : defaultCategory,
  );
  const [message, setMessage] = useState("");
  const [replyEmail, setReplyEmail] = useState("");
  const [submissionId] = useState(newSubmissionId);
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  const submit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const trimmed = message.trim();
      if (!trimmed && !context) {
        setState({ kind: "error", message: t("messageRequired") });
        return;
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setState({
          kind: "error",
          message: t("offlineHint"),
          offline: true,
        });
        return;
      }

      setState({ kind: "pending" });
      try {
        const body = {
          clientSubmissionId: submissionId,
          category,
          message: trimmed || t("defaultBugMessage"),
          replyEmail: replyEmail.trim() || undefined,
          diagnostic: context
            ? {
                module: context.module,
                operation: context.operation,
                routeId: context.routeId,
                errorCode: context.errorCode,
                faultId: context.faultId,
                source: context.source ?? "server",
                occurredAt: new Date().toISOString(),
                appVersion: APP_VERSION,
              }
            : {
                module: "general" as const,
                operation: "manual_contact",
                routeId: "contact",
                source: "manual" as const,
                occurredAt: new Date().toISOString(),
                appVersion: APP_VERSION,
              },
        };
        const res = await fetch("/api/support/reports", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "accept-language": locale,
          },
          body: JSON.stringify(body),
        });
        const json = (await res.json().catch(() => null)) as {
          acceptanceNumber?: string;
          error?: string;
          message?: string;
        } | null;
        if (!res.ok) {
          if (res.status === 429) {
            setState({ kind: "error", message: t("rateLimited") });
            return;
          }
          setState({
            kind: "error",
            message: t("submitFailed"),
          });
          return;
        }
        if (!json?.acceptanceNumber) {
          setState({ kind: "error", message: t("submitFailed") });
          return;
        }
        setState({
          kind: "success",
          acceptanceNumber: json.acceptanceNumber,
        });
      } catch {
        const offline =
          typeof navigator !== "undefined" && !navigator.onLine;
        setState({
          kind: "error",
          message: offline ? t("offlineHint") : t("submitFailed"),
          offline,
        });
      }
    },
    [category, context, locale, message, replyEmail, submissionId, t],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="support-report-dialog"
      className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 id={titleId} className="text-lg font-semibold text-[#084f49]">
          {t("dialogTitle")}
        </h2>
        <button
          type="button"
          className="rounded px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100"
          onClick={onClose}
          data-testid="support-report-cancel"
        >
          {t("cancel")}
        </button>
      </div>

      {state.kind === "success" ? (
        <div className="space-y-3" data-testid="support-report-success">
          <p className="text-sm text-zinc-800">{t("accepted")}</p>
          <p className="rounded bg-teal-50 px-3 py-2 font-mono text-sm text-teal-900">
            {t("acceptanceLabel")}{" "}
            <span data-testid="support-acceptance-number">
              {state.acceptanceNumber}
            </span>
          </p>
          <button
            type="button"
            className="rounded bg-[#0d6b63] px-4 py-2 text-sm text-white"
            onClick={onClose}
          >
            {t("close")}
          </button>
        </div>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-zinc-800">
              {t("categoryLabel")}
            </legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="category"
                value="bug_report"
                checked={category === "bug_report"}
                onChange={() => setCategory("bug_report")}
              />
              {t("categoryBug")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="category"
                value="other_inquiry"
                checked={category === "other_inquiry"}
                onChange={() => setCategory("other_inquiry")}
              />
              {t("categoryOther")}
            </label>
          </fieldset>

          {context ? (
            <p
              className="rounded bg-zinc-50 px-3 py-2 text-xs text-zinc-600"
              data-testid="support-fault-context"
            >
              {t("contextAttached")}
              {context.faultId
                ? ` (${t("faultIdLabel")}: ${context.faultId})`
                : ""}
            </p>
          ) : null}

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">
              {context ? t("messageOptionalExtra") : t("messageRequiredLabel")}
            </span>
            <textarea
              required={!context}
              rows={5}
              maxLength={4000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="rounded border border-zinc-300 px-3 py-2"
              data-testid="support-report-message"
              placeholder={
                context ? t("messagePlaceholderBug") : t("messagePlaceholder")
              }
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("emailOptional")}</span>
            <input
              type="email"
              value={replyEmail}
              onChange={(e) => setReplyEmail(e.target.value)}
              className="rounded border border-zinc-300 px-3 py-2"
              data-testid="support-report-email"
              autoComplete="email"
            />
          </label>

          {state.kind === "error" ? (
            <p role="alert" className="text-sm text-red-700">
              {state.message}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={state.kind === "pending"}
              className="rounded bg-[#0d6b63] px-4 py-2 text-sm text-white disabled:opacity-50"
              data-testid="support-report-submit"
            >
              {state.kind === "pending" ? t("submitting") : t("submit")}
            </button>
            <button
              type="button"
              className="rounded border border-zinc-300 px-4 py-2 text-sm"
              onClick={onClose}
            >
              {t("cancel")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function ReportIssueDialog({
  open,
  onClose,
  context,
  defaultCategory = "other_inquiry",
}: Props) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Remount form on each open so category/submission id reset without effects. */}
      <ReportIssueForm
        key={`${context?.faultId ?? "manual"}-${defaultCategory}-${open}`}
        context={context}
        defaultCategory={defaultCategory}
        onClose={onClose}
      />
    </div>,
    document.body,
  );
}

/** Inline CTA next to a system error alert. */
export function ReportIssueButton({
  context,
  className,
}: {
  context: ReportIssueContext;
  className?: string;
}) {
  const t = useTranslations("Support");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={
          className ??
          "ml-2 inline text-sm font-medium text-[#0d6b63] underline-offset-2 hover:underline"
        }
        onClick={() => setOpen(true)}
        data-testid="support-report-this-issue"
      >
        {t("reportThisIssue")}
      </button>
      <ReportIssueDialog
        open={open}
        onClose={() => setOpen(false)}
        context={context}
      />
    </>
  );
}
