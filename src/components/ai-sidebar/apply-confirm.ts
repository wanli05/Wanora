import { moduleFieldLabelJa } from "@/components/ai-sidebar/refine-prompts";

/**
 * Bullet list for the single multi-field Apply confirm dialog.
 * Only include fields that will actually be written.
 */
export function formatMultiApplyFieldList(
  fieldIds: readonly string[],
): string {
  return fieldIds.map((id) => moduleFieldLabelJa(id)).join("\n・");
}
