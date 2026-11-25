import type { AiPageContext, AiTargetContext } from "@/lib/ai/context/types";

export type SuggestionChip = {
  id: string;
  /** i18n key under AiSidebar */
  labelKey:
    | "suggestImproveSelfPr"
    | "suggestAnalyzeCareer"
    | "suggestCareerChat"
    | "suggestBoardOrganize"
    | "suggestInterviewPrep"
    | "suggestApplyStrategy"
    | "suggestResumeTips";
  /** Safe prompt filled into the composer — does not claim field contents were read. */
  promptKey:
    | "suggestPromptImproveSelfPr"
    | "suggestPromptAnalyzeCareer"
    | "suggestPromptCareerChat"
    | "suggestPromptBoardOrganize"
    | "suggestPromptInterviewPrep"
    | "suggestPromptApplyStrategy"
    | "suggestPromptResumeTips";
  /** Optional Target set only when the user explicitly picks this chip. */
  target: AiTargetContext | null;
};

/** Page-aware chips for empty conversations. Generic wording only. */
export function suggestionsForPage(
  page: Pick<AiPageContext, "area">,
): SuggestionChip[] {
  if (page.area === "my_career") {
    return [
      {
        id: "self_pr",
        labelKey: "suggestImproveSelfPr",
        promptKey: "suggestPromptImproveSelfPr",
        target: { type: "profile", section: "self_pr" },
      },
      {
        id: "career_analyze",
        labelKey: "suggestAnalyzeCareer",
        promptKey: "suggestPromptAnalyzeCareer",
        target: { type: "profile", section: "job_summary" },
      },
      {
        id: "career_chat",
        labelKey: "suggestCareerChat",
        promptKey: "suggestPromptCareerChat",
        target: null,
      },
    ];
  }
  if (page.area === "board") {
    return [
      {
        id: "board_organize",
        labelKey: "suggestBoardOrganize",
        promptKey: "suggestPromptBoardOrganize",
        target: null,
      },
      {
        id: "interview_prep",
        labelKey: "suggestInterviewPrep",
        promptKey: "suggestPromptInterviewPrep",
        target: null,
      },
      {
        id: "apply_strategy",
        labelKey: "suggestApplyStrategy",
        promptKey: "suggestPromptApplyStrategy",
        target: null,
      },
    ];
  }
  return [
    {
      id: "career_chat",
      labelKey: "suggestCareerChat",
      promptKey: "suggestPromptCareerChat",
      target: null,
    },
    {
      id: "resume_tips",
      labelKey: "suggestResumeTips",
      promptKey: "suggestPromptResumeTips",
      target: null,
    },
  ];
}
