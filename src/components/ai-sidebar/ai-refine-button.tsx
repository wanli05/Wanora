"use client";

import { useAiAssistOptional } from "@/components/ai-sidebar/ai-assist-context";
import {
  refineFeatureForField,
  targetForRefineField,
  type RefineFieldKey,
} from "@/components/ai-sidebar/refine-prompts";

type Props = {
  fieldKey: RefineFieldKey;
  /** Latest draft text at click time. */
  draftText: string;
  /** Saved row id when available; omit / empty for unsaved new rows. */
  recordId?: string | null;
  getCurrentDraft: () => string;
  onApplyToDraft: (refined: string) => void;
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
        const limitedContext = target == null && (fieldKey === "narrative_ja" || fieldKey === "overview_ja");
        void assist.openWithAssist({
          target,
          draftText,
          feature: refineFeatureForField(fieldKey),
          fieldKey,
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
