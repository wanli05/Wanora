import type { RefineFieldKey } from "@/components/ai-sidebar/refine-prompts";

/** i18n keys under AiSidebar for AssistSession-bound context chrome. */
export type AssistContextLabelKeys = {
  referenceKey:
    | "assistRefProfile"
    | "assistRefProject"
    | "assistRefEmployer"
    | "assistRefLegacyProfile";
  scopeKey:
    | "assistScopeProfile"
    | "assistScopeProject"
    | "assistScopeEmployer"
    | "assistScopeLegacySelfPr"
    | "assistScopeLegacyJobSummary"
    | "assistScopeLegacyOverview";
};

/**
 * Labels for My Career refine AssistSession — derived from fieldKey only
 * (not from the current page URL).
 */
export function assistContextLabelKeys(
  fieldKey: RefineFieldKey,
): AssistContextLabelKeys {
  switch (fieldKey) {
    case "profile_module":
      return {
        referenceKey: "assistRefProfile",
        scopeKey: "assistScopeProfile",
      };
    case "project_module":
      return {
        referenceKey: "assistRefProject",
        scopeKey: "assistScopeProject",
      };
    case "overview_ja":
      return {
        referenceKey: "assistRefProject",
        scopeKey: "assistScopeLegacyOverview",
      };
    case "narrative_ja":
      return {
        referenceKey: "assistRefEmployer",
        scopeKey: "assistScopeEmployer",
      };
    case "selfPr_ja":
      return {
        referenceKey: "assistRefLegacyProfile",
        scopeKey: "assistScopeLegacySelfPr",
      };
    case "jobSummary_ja":
      return {
        referenceKey: "assistRefLegacyProfile",
        scopeKey: "assistScopeLegacyJobSummary",
      };
    default: {
      const _exhaustive: never = fieldKey;
      return _exhaustive;
    }
  }
}

/** True when the optional focus adjuster must stay hidden. */
export function shouldHideFocusAdjuster(
  assistFieldKey: RefineFieldKey | null | undefined,
): boolean {
  return assistFieldKey != null;
}
