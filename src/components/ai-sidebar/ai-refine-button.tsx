"use client";

import { useAiAssistOptional } from "@/components/ai-sidebar/ai-assist-context";
import {
  buildModuleRefinePrompt,
  PROFILE_MODULE_FIELD_IDS,
  PROJECT_MODULE_FIELD_IDS,
  refineFeatureForField,
  serializeModuleDrafts,
  targetForRefineField,
  type RefineFieldKey,
  type RefineModuleFieldId,
} from "@/components/ai-sidebar/refine-prompts";

type SingleProps = {
  fieldKey: Exclude<RefineFieldKey, "profile_module" | "project_module">;
  /** Latest draft text at click time (snapshot seed). */
  draftText: string;
  /** Saved row id when available; omit / empty for unsaved new rows. */
  recordId?: string | null;
  /**
   * Per-editor-instance key for unsaved employer/project rows.
   * Required when recordId is empty for narrative_ja.
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
 * Used for employer narrative (single-field) and legacy reopen paths.
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
}: SingleProps) {
  const assist = useAiAssistOptional();

  if (!assist) return null;

  return (
    <button
      type="button"
      className="mc-btn-ai-refine"
      data-testid={testId ?? `ai-refine-${fieldKey}`}
      disabled={disabled}
      onClick={() => {
        const id = recordId?.trim() || null;
        const target = targetForRefineField(fieldKey, id);
        const limitedContext =
          target == null && fieldKey === "narrative_ja";
        void assist.openWithAssist({
          target,
          draftText,
          feature: refineFeatureForField(fieldKey),
          fieldKey,
          recordId: id,
          clientDraftKey: clientDraftKey ?? null,
          draftSnapshot: draftText,
          limitedContext,
          applyMode: "single",
          getCurrentDraft,
          onApplyToDraft,
        });
      }}
    >
      {label}
    </button>
  );
}

type ModuleProps = {
  kind: "profile" | "project";
  drafts: Readonly<Record<string, string>>;
  getCurrentDrafts: () => Record<string, string>;
  onApplyFields: (fields: Readonly<Record<string, string>>) => boolean;
  /** Legacy unlabeled bubble → overview only (project) or no-op (profile). */
  onApplyToDraft?: (refined: string) => boolean;
  recordId?: string | null;
  clientDraftKey?: string | null;
  label?: string;
  disabled?: boolean;
  testId?: string;
};

/**
 * Module-level entry: one button, multi-field drafts, labeled Apply protocol.
 */
export function AiModuleRefineButton({
  kind,
  drafts,
  getCurrentDrafts,
  onApplyFields,
  onApplyToDraft,
  recordId,
  clientDraftKey,
  label = "AIで添削",
  disabled,
  testId,
}: ModuleProps) {
  const assist = useAiAssistOptional();
  if (!assist) return null;

  const fieldKey: RefineFieldKey =
    kind === "profile" ? "profile_module" : "project_module";
  const fieldIds: readonly RefineModuleFieldId[] =
    kind === "profile" ? PROFILE_MODULE_FIELD_IDS : PROJECT_MODULE_FIELD_IDS;
  const feature = refineFeatureForField(fieldKey);

  return (
    <button
      type="button"
      className="mc-btn-ai-refine"
      data-testid={
        testId ??
        (kind === "profile"
          ? "ai-refine-profile-module"
          : "ai-refine-project-module")
      }
      disabled={disabled}
      onClick={() => {
        const id = recordId?.trim() || null;
        const target = targetForRefineField(fieldKey, id);
        const limitedContext =
          kind === "project" && target == null;
        // Prefer live ref reader; fall back to last rendered drafts prop.
        const live = { ...drafts, ...getCurrentDrafts() };
        const snapshot = serializeModuleDrafts(fieldIds, live);
        const prompt = buildModuleRefinePrompt({
          feature: feature as "profile_module_refine" | "career_project_refine",
          fieldIds,
          drafts: live,
          limitedContext,
        });
        void assist.openWithAssist({
          target,
          draftText: prompt,
          feature,
          fieldKey,
          recordId: id,
          clientDraftKey: clientDraftKey ?? null,
          draftSnapshot: snapshot,
          limitedContext,
          applyMode: "multi",
          allowedFieldIds: fieldIds,
          getCurrentDraft: () =>
            serializeModuleDrafts(fieldIds, getCurrentDrafts()),
          getCurrentDrafts,
          onApplyFields,
          onApplyToDraft: onApplyToDraft ?? (() => false),
        });
      }}
    >
      {label}
    </button>
  );
}
