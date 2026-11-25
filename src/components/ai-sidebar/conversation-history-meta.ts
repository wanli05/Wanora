import { parseAssistSlotKey } from "@/lib/ai/conversation/assist-slot";

export type HistorySourceKey =
  | "historySourceProfile"
  | "historySourceProject"
  | "historySourceEmployer"
  | "historySourceGeneral"
  | null;

/** Derive a short source label key from assist_slot_key; omit when unknown. */
export function historySourceKeyFromSlot(
  assistSlotKey: string | null | undefined,
): HistorySourceKey {
  if (!assistSlotKey) return "historySourceGeneral";
  const parsed = parseAssistSlotKey(assistSlotKey);
  if (!parsed) return null;
  if (parsed.kind === "profile") {
    return "historySourceProfile";
  }
  if (parsed.kind === "career_project") return "historySourceProject";
  if (parsed.kind === "career_employer") return "historySourceEmployer";
  return null;
}

export function formatConversationDate(
  iso: string,
  locale: string,
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}
