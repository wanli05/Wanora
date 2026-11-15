import type { AiContextFragment } from "@/lib/ai/context/types";

const SECTION_PRIORITY: Record<string, number> = {
  target: 100,
  profile: 90,
  projects: 70,
  employers: 60,
  work_history: 50,
  education: 40,
  licenses: 30,
  skills: 20,
  goals: 10,
};

function priority(fragment: AiContextFragment): number {
  return SECTION_PRIORITY[fragment.section] ?? 0;
}

function stubOmitted(fragment: AiContextFragment): AiContextFragment {
  const data = {
    omitted: true,
    reason: "max_context_chars",
    sourceId: fragment.sourceId,
    section: fragment.section,
  };
  return {
    sourceId: fragment.sourceId,
    section: fragment.section,
    label: fragment.label,
    data,
    charCount: JSON.stringify(data).length,
    truncated: true,
    notes: [...(fragment.notes ?? []), "omitted_for_size"],
  };
}

/**
 * Fit fragments under `maxChars` while keeping source attribution.
 * Drops lowest-priority full payloads first, replacing them with stubs.
 * Never drops the `target` section stub entirely if present.
 */
export function trimContextFragments(
  fragments: AiContextFragment[],
  maxChars: number,
): { fragments: AiContextFragment[]; truncated: boolean; totalChars: number } {
  const working = fragments.map((f) => ({ ...f }));
  const sum = () => working.reduce((n, f) => n + f.charCount, 0);

  if (sum() <= maxChars) {
    return { fragments: working, truncated: false, totalChars: sum() };
  }

  let truncated = false;
  const dropOrder = [...working.keys()].sort(
    (a, b) => priority(working[a]) - priority(working[b]),
  );

  for (const index of dropOrder) {
    if (sum() <= maxChars) break;
    const current = working[index];
    if (current.section === "target" && !current.truncated) {
      // Shrink target last: keep a truncated copy of data keys only.
      const slim = {
        truncated: true,
        summary: "target payload trimmed",
        typeHint:
          current.data && typeof current.data === "object"
            ? Object.keys(current.data as object).slice(0, 8)
            : [],
      };
      working[index] = {
        ...current,
        data: slim,
        charCount: JSON.stringify(slim).length,
        truncated: true,
        notes: [...(current.notes ?? []), "trimmed"],
      };
      truncated = true;
      continue;
    }
    if (current.truncated && current.notes?.includes("omitted_for_size")) {
      continue;
    }
    working[index] = stubOmitted(current);
    truncated = true;
  }

  // If still over (tiny maxChars), force stub everything except one target/profile stub.
  if (sum() > maxChars) {
    for (let i = 0; i < working.length; i++) {
      if (sum() <= maxChars) break;
      working[i] = stubOmitted(working[i]);
      truncated = true;
    }
  }

  return { fragments: working, truncated, totalChars: sum() };
}
