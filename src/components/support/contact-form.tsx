"use client";

import { SupportReportForm } from "@/components/support/support-report-form";

/** Public お問い合わせ — inline form (no open button / dialog). */
export function ContactForm() {
  return (
    <SupportReportForm
      mode="page"
      defaultCategory="other_inquiry"
      className="w-full max-w-xl"
    />
  );
}
