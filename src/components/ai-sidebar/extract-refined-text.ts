import {
  REFINE_RESULT_END,
  REFINE_RESULT_START,
} from "@/components/ai-sidebar/refine-prompts";

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  while (from <= haystack.length) {
    const idx = haystack.indexOf(needle, from);
    if (idx < 0) break;
    count += 1;
    from = idx + needle.length;
  }
  return count;
}

/**
 * Extract the refined body from an assistant reply.
 * Fail-closed: only a single unambiguous START/END pair with non-empty body is accepted.
 * Ambiguous / nested / duplicated markers → null (caller must fall back to copy-only).
 */
export function extractRefinedText(assistantContent: string): string | null {
  const text = assistantContent ?? "";
  const startCount = countOccurrences(text, REFINE_RESULT_START);
  const endCount = countOccurrences(text, REFINE_RESULT_END);
  if (startCount !== 1 || endCount !== 1) return null;

  const start = text.indexOf(REFINE_RESULT_START);
  const afterStart = start + REFINE_RESULT_START.length;
  const end = text.indexOf(REFINE_RESULT_END, afterStart);
  if (end < 0) return null;

  // Reject if END somehow preceded START for the only occurrences, or body re-embeds markers.
  const body = text.slice(afterStart, end);
  if (
    body.includes(REFINE_RESULT_START) ||
    body.includes(REFINE_RESULT_END)
  ) {
    return null;
  }

  const trimmed = body.trim();
  return trimmed.length > 0 ? trimmed : null;
}
