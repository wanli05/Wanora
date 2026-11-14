import { jaOf } from "@/lib/domain/career";
import type { LocalizedText } from "@/lib/domain/localized-text";

/** Display name for the global header — never the account email. */
export function headerDisplayName(input: {
  fullName?: LocalizedText | null;
  /** Auth signup name; used only when profile JA name is empty. */
  sessionName?: string | null;
}): string {
  const fromProfile = jaOf(input.fullName);
  if (fromProfile) return fromProfile;
  const fromSession = input.sessionName?.trim() ?? "";
  if (fromSession && !fromSession.includes("@")) return fromSession;
  return "";
}

/** First grapheme for avatar fallback, or empty when no name. */
export function headerAvatarInitial(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) return "";
  return Array.from(trimmed)[0] ?? "";
}
