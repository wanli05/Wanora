"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ReportIssueDialog } from "@/components/support/report-issue-dialog";

/** Public お問い合わせ entry — opens the shared report dialog. */
export function ContactForm() {
  const t = useTranslations("ContactPage");
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      <button
        type="button"
        className="rounded bg-[#0d6b63] px-4 py-2 text-sm text-white"
        onClick={() => setOpen(true)}
        data-testid="contact-open-form"
      >
        {t("openForm")}
      </button>
      <ReportIssueDialog
        open={open}
        onClose={() => setOpen(false)}
        defaultCategory="other_inquiry"
      />
    </div>
  );
}
