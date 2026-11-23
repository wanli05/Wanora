import {
  REFINE_RESULT_END,
  REFINE_RESULT_START,
} from "@/components/ai-sidebar/refine-prompts";

/** Labeled multi-field start: 【修正案:field_id】 */
export const REFINE_LABELED_START_RE = /【修正案:([a-z0-9_]+)】/gi;

/** Unlabeled start that is not a labeled prefix (【修正案】 not followed by :). */
const UNLABELED_START_RE = /【修正案】(?!:)/g;

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

function countRegex(haystack: string, re: RegExp): number {
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  const copy = new RegExp(re.source, flags);
  return [...haystack.matchAll(copy)].length;
}

function hasLabeledStarts(text: string): boolean {
  return countRegex(text, REFINE_LABELED_START_RE) > 0;
}

function hasUnlabeledStarts(text: string): boolean {
  return countRegex(text, UNLABELED_START_RE) > 0;
}

/**
 * Extract the refined body from an assistant reply (single-field / legacy).
 * Fail-closed: only a single unambiguous **unlabeled** START/END pair with
 * non-empty body is accepted. Any labeled `【修正案:id】` → null.
 */
export function extractRefinedText(assistantContent: string): string | null {
  const text = assistantContent ?? "";
  if (hasLabeledStarts(text)) return null;

  const startCount = countRegex(text, UNLABELED_START_RE);
  const endCount = countOccurrences(text, REFINE_RESULT_END);
  if (startCount !== 1 || endCount !== 1) return null;

  const startMatch = text.match(/【修正案】(?!:)/);
  if (!startMatch || startMatch.index == null) return null;

  const afterStart = startMatch.index + REFINE_RESULT_START.length;
  const end = text.indexOf(REFINE_RESULT_END, afterStart);
  if (end < 0) return null;

  const body = text.slice(afterStart, end);
  if (
    body.includes(REFINE_RESULT_START) ||
    body.includes(REFINE_RESULT_END) ||
    hasLabeledStarts(body)
  ) {
    return null;
  }

  const trimmed = body.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Parse labeled multi-field refine pairs.
 * Fail-closed on: mix with unlabeled, unknown id, duplicate id, nested markers,
 * zero pairs, empty body for a pair.
 * Returns only fields present in the reply (partial apply); missing allowed ids
 * are simply absent from the result.
 */
export function extractRefinedFields(
  assistantContent: string,
  allowedFieldIds: readonly string[],
): Record<string, string> | null {
  const text = assistantContent ?? "";
  const allowed = new Set(
    allowedFieldIds.map((id) => id.trim().toLowerCase()).filter(Boolean),
  );
  if (allowed.size === 0) return null;

  if (hasUnlabeledStarts(text)) return null;

  const startRe = new RegExp(REFINE_LABELED_START_RE.source, "gi");
  const starts: { fieldId: string; bodyStart: number; fullStart: number }[] =
    [];
  for (const m of text.matchAll(startRe)) {
    if (m.index == null) continue;
    const fieldId = (m[1] ?? "").toLowerCase();
    starts.push({
      fieldId,
      fullStart: m.index,
      bodyStart: m.index + m[0].length,
    });
  }
  if (starts.length === 0) return null;

  const endCount = countOccurrences(text, REFINE_RESULT_END);
  if (endCount !== starts.length) return null;

  const seen = new Set<string>();
  const out: Record<string, string> = {};

  for (let i = 0; i < starts.length; i++) {
    const cur = starts[i]!;
    if (!allowed.has(cur.fieldId)) return null;
    if (seen.has(cur.fieldId)) return null;
    seen.add(cur.fieldId);

    const end = text.indexOf(REFINE_RESULT_END, cur.bodyStart);
    if (end < 0) return null;
    // End must appear before the next labeled start (if any).
    const nextStart = starts[i + 1]?.fullStart ?? text.length;
    if (end >= nextStart) return null;

    const body = text.slice(cur.bodyStart, end);
    if (
      hasLabeledStarts(body) ||
      hasUnlabeledStarts(body) ||
      body.includes(REFINE_RESULT_END)
    ) {
      return null;
    }
    const trimmed = body.trim();
    if (!trimmed) return null;
    out[cur.fieldId] = trimmed;
  }

  return Object.keys(out).length > 0 ? out : null;
}
