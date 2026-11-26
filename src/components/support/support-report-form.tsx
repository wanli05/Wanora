"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useId,
  useState,
  type FormEvent,
} from "react";
import { APP_VERSION } from "@/lib/app-version";
import { detectBrowserInfo } from "@/lib/support/browser-info";
import { createClientSubmissionId } from "@/lib/support/client-submission-id";
import type {
  ReportIssueContext,
  SupportCategory,
} from "@/lib/support/types";

export type SupportReportFormMode = "page" | "dialog";

type SubmitState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "success"; acceptanceNumber: string }
  | {
      kind: "error";
      message: string;
      field?: "message" | "email" | "form";
      offline?: boolean;
    };

type Props = {
  mode: SupportReportFormMode;
  /** Prefill when opened from a system error (dialog). */
  context?: ReportIssueContext | null;
  defaultCategory?: SupportCategory;
  /** Dialog only: close / dismiss control. */
  onClose?: () => void;
  className?: string;
};

function buildDiagnostic(
  category: SupportCategory,
  context: ReportIssueContext | null | undefined,
) {
  const browser = detectBrowserInfo();
  const browserFields = browser
    ? { browserName: browser.name, browserVersion: browser.version }
    : {};

  if (context) {
    return {
      module: context.module,
      operation: context.operation,
      routeId: context.routeId,
      errorCode: context.errorCode,
      faultId: context.faultId,
      source: context.source ?? "server",
      occurredAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      ...browserFields,
    };
  }

  return {
    module: "general" as const,
    operation: category === "bug_report" ? "manual_bug_report" : "manual_contact",
    routeId: "contact",
    source: "manual" as const,
    occurredAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    ...browserFields,
  };
}

/**
 * Shared お問い合わせ fields for the public page and the error-report dialog.
 */
export function SupportReportForm({
  mode,
  context,
  defaultCategory = "other_inquiry",
  onClose,
  className,
}: Props) {
  const t = useTranslations("Support");
  const locale = useLocale();
  const titleId = useId();
  const [category, setCategory] = useState<SupportCategory>(
    context ? "bug_report" : defaultCategory,
  );
  const [message, setMessage] = useState("");
  const [replyEmail, setReplyEmail] = useState("");
  /** Stable for retries of the same form mount (idempotency). */
  const [submissionId] = useState(createClientSubmissionId);
  const [state, setState] = useState<SubmitState>({ kind: "idle" });
  const [emailInvalid, setEmailInvalid] = useState(false);

  const fromError = Boolean(context);
  const showBrowserNote = category === "bug_report";
  const browser = showBrowserNote ? detectBrowserInfo() : null;

  const messagePlaceholder =
    category === "bug_report" && !fromError
      ? t("messagePlaceholderBugGuide")
      : fromError
        ? t("messagePlaceholderBug")
        : t("messagePlaceholder");

  const messageLabel = fromError
    ? t("messageOptionalExtra")
    : t("messageRequiredLabel");

  const submit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const trimmed = message.trim();
      const email = replyEmail.trim();

      if (!trimmed && !fromError) {
        setState({
          kind: "error",
          message: t("messageRequired"),
          field: "message",
        });
        return;
      }

      if (email) {
        // Lightweight client check; server Zod remains authoritative.
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          setEmailInvalid(true);
          setState({
            kind: "error",
            message: t("emailInvalid"),
            field: "email",
          });
          return;
        }
      }
      setEmailInvalid(false);

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setState({
          kind: "error",
          message: t("offlineHint"),
          field: "form",
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
          replyEmail: email || undefined,
          diagnostic: buildDiagnostic(category, context),
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
            setState({
              kind: "error",
              message: t("rateLimited"),
              field: "form",
            });
            return;
          }
          if (res.status === 503) {
            setState({
              kind: "error",
              message: t("unavailable"),
              field: "form",
            });
            return;
          }
          if (res.status === 400) {
            setState({
              kind: "error",
              message: t("invalidBody"),
              field: "form",
            });
            return;
          }
          setState({
            kind: "error",
            message: t("submitFailed"),
            field: "form",
          });
          return;
        }
        if (!json?.acceptanceNumber) {
          setState({
            kind: "error",
            message: t("submitFailed"),
            field: "form",
          });
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
          field: "form",
          offline,
        });
      }
    },
    [
      category,
      context,
      fromError,
      locale,
      message,
      replyEmail,
      submissionId,
      t,
    ],
  );

  if (state.kind === "success") {
    return (
      <div
        className={className ?? "space-y-3"}
        data-testid="support-report-success"
      >
        <p className="text-sm text-zinc-800">{t("accepted")}</p>
        <p className="rounded bg-teal-50 px-3 py-2 font-mono text-sm text-teal-900">
          {t("acceptanceLabel")}{" "}
          <span data-testid="support-acceptance-number">
            {state.acceptanceNumber}
          </span>
        </p>
        {mode === "dialog" && onClose ? (
          <button
            type="button"
            className="rounded bg-[#0d6b63] px-4 py-2 text-sm text-white"
            onClick={onClose}
          >
            {t("close")}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={className}
      {...(mode === "dialog"
        ? {
            role: "dialog" as const,
            "aria-modal": true as const,
            "aria-labelledby": titleId,
            "data-testid": "support-report-dialog",
          }
        : { "data-testid": "support-report-page-form" })}
      onClick={mode === "dialog" ? (e) => e.stopPropagation() : undefined}
    >
      {mode === "dialog" ? (
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold text-[#084f49]">
            {t("dialogTitle")}
          </h2>
          {onClose ? (
            <button
              type="button"
              className="rounded px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100"
              onClick={onClose}
              data-testid="support-report-cancel"
            >
              {t("cancel")}
            </button>
          ) : null}
        </div>
      ) : null}

      <form
        className="flex flex-col gap-4"
        method="post"
        onSubmit={submit}
        noValidate
      >
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-zinc-800">
            {t("categoryLabel")}
          </legend>
          <div
            role="radiogroup"
            aria-label={t("categoryLabel")}
            className="flex flex-col gap-2"
          >
            <button
              type="button"
              role="radio"
              aria-checked={category === "bug_report"}
              data-testid="support-category-bug"
              className={`rounded border px-3 py-2 text-left text-sm ${
                category === "bug_report"
                  ? "border-[#0d6b63] bg-teal-50 text-[#084f49]"
                  : "border-zinc-300 text-zinc-800"
              }`}
              onClick={() => setCategory("bug_report")}
            >
              {t("categoryBug")}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={category === "other_inquiry"}
              data-testid="support-category-other"
              className={`rounded border px-3 py-2 text-left text-sm ${
                category === "other_inquiry"
                  ? "border-[#0d6b63] bg-teal-50 text-[#084f49]"
                  : "border-zinc-300 text-zinc-800"
              }`}
              onClick={() => setCategory("other_inquiry")}
            >
              {t("categoryOther")}
            </button>
          </div>
        </fieldset>

        {fromError && context ? (
          <div
            className="rounded bg-zinc-50 px-3 py-2 text-xs text-zinc-600"
            data-testid="support-fault-context"
          >
            <p>{t("contextAttached")}</p>
            <ul className="mt-1 space-y-0.5 font-mono">
              {context.errorCode ? (
                <li>
                  {t("errorCodeLabel")} {context.errorCode}
                </li>
              ) : null}
              {context.faultId ? (
                <li>
                  {t("faultIdLabel")} {context.faultId}
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{messageLabel}</span>
          <textarea
            required={!fromError}
            rows={6}
            maxLength={4000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2"
            data-testid="support-report-message"
            placeholder={messagePlaceholder}
            aria-invalid={state.kind === "error" && state.field === "message"}
          />
          {state.kind === "error" && state.field === "message" ? (
            <span role="alert" className="text-sm text-red-700">
              {state.message}
            </span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("emailOptional")}</span>
          <input
            type="email"
            value={replyEmail}
            onChange={(e) => {
              setReplyEmail(e.target.value);
              setEmailInvalid(false);
            }}
            className="rounded border border-zinc-300 px-3 py-2"
            data-testid="support-report-email"
            autoComplete="email"
            aria-invalid={emailInvalid}
          />
          {state.kind === "error" && state.field === "email" ? (
            <span role="alert" className="text-sm text-red-700">
              {state.message}
            </span>
          ) : null}
        </label>

        {showBrowserNote && browser ? (
          <p className="text-xs text-zinc-500" data-testid="support-browser-note">
            {t("browserNote", {
              name: browser.name,
              version: browser.version,
            })}
          </p>
        ) : null}

        {state.kind === "error" && state.field === "form" ? (
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
        </div>
      </form>
    </div>
  );
}
