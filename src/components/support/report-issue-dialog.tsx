"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { createPortal } from "react-dom";
import { SupportReportForm } from "@/components/support/support-report-form";
import type {
  ReportIssueContext,
  SupportCategory,
  SupportErrorCode,
} from "@/lib/support/types";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Prefill when opened from a system error. */
  context?: ReportIssueContext | null;
  /** Default category when no context. */
  defaultCategory?: SupportCategory;
};

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
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <SupportReportForm
          key={`${context?.faultId ?? "manual"}-${defaultCategory}-${open}`}
          mode="dialog"
          context={context}
          defaultCategory={defaultCategory}
          onClose={onClose}
        />
      </div>
    </div>,
    document.body,
  );
}

/** Compact エラー詳細 lines shown next to a system error alert. */
export function ErrorDiagnosticDetails({
  errorCode,
  faultId,
}: {
  errorCode?: SupportErrorCode | string | null;
  faultId?: string | null;
}) {
  const t = useTranslations("Support");
  if (!errorCode && !faultId) return null;
  return (
    <div
      className="mt-1 space-y-0.5 font-mono text-xs text-zinc-600"
      data-testid="support-error-details"
    >
      <p className="font-sans text-xs font-medium text-zinc-700">
        {t("errorDetailsHeading")}
      </p>
      {errorCode ? (
        <p>
          {t("errorCodeLabel")} {errorCode}
        </p>
      ) : null}
      {faultId ? (
        <p>
          {t("faultIdLabel")} {faultId}
        </p>
      ) : null}
    </div>
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
