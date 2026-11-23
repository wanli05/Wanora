"use client";

import { useAiAssistOptional } from "@/components/ai-sidebar/ai-assist-context";
import {
  refineFeatureForField,
  targetForRefineField,
  type RefineFieldKey,
} from "@/components/ai-sidebar/refine-prompts";

type Props = {
  fieldKey: RefineFieldKey;
  /** Latest draft text at click time (snapshot seed). */
  draftText: string;
  /** Saved row id when available; omit / empty for unsaved new rows. */
  recordId?: string | null;
  /**
   * Per-editor-instance key for unsaved employer/project rows.
   * Required when recordId is empty for narrative_ja / overview_ja.
   */
  clientDraftKey?: string | null;
  /** Live draft reader — must not close over stale render consts. */
  getCurrentDraft: () => string;
  /** Returns false when binding is stale / unmounted. */
  onApplyToDraft: (refined: string) => boolean;
  label?: string;
  disabled?: boolean;
  testId?: string;
};

/**
 * Field-level entry that opens the shared AI sidebar (never auto-sends).
 */
export function AiRefineButton({
  fieldKey,
  draftText,
  recordId,
  clientDraftKey,
  getCurrentDraft,
  onApplyToDraft,
  label = "AIで添削",
  disabled,
  testId,
}: Props) {
  const assist = useAiAssistOptional();

  if (!assist) return null;

  return (
    <button
      type="button"
      className="mc-btn mc-btn-ghost"
      data-testid={testId ?? `ai-refine-${fieldKey}`}
      disabled={disabled}
      onClick={() => {
        const id = recordId?.trim() || null;
        const target = targetForRefineField(fieldKey, id);
        const limitedContext =
          target == null &&
          (fieldKey === "narrative_ja" || fieldKey === "overview_ja");
        void assist.openWithAssist({
          target,
          draftText,
          feature: refineFeatureForField(fieldKey),
          fieldKey,
          recordId: id,
          clientDraftKey: clientDraftKey ?? null,
          draftSnapshot: draftText,
          limitedContext,
          getCurrentDraft,
          onApplyToDraft,
        });
      }}
    >
      {label}
    </button>
  );
}
