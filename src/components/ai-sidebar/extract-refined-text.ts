import {
  REFINE_RESULT_END,
  REFINE_RESULT_START,
} from "@/components/ai-sidebar/refine-prompts";

/**
 * Extract the refined body from an assistant reply.
 * Returns null when markers are missing or empty — caller must fall back to copy-only.
 */
export function extractRefinedText(assistantContent: string): string | null {
  const text = assistantContent ?? "";
  const start = text.indexOf(REFINE_RESULT_START);
  if (start < 0) return null;
  const afterStart = start + REFINE_RESULT_START.length;
  const end = text.indexOf(REFINE_RESULT_END, afterStart);
  if (end < 0) return null;
  const body = text.slice(afterStart, end).trim();
  return body.length > 0 ? body : null;
}
