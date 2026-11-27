/**
 * Compatibility shim: Phase 2A UI v2 uses `base-themes.ts` as the source of
 * the seven fixed prep themes. Stage-specific mock packs are retired.
 */
import type { StageKind } from "@/lib/progress/enums";
import {
  findPrepBaseTheme,
  prepBaseThemes,
  type PrepBaseTheme,
} from "./base-themes";

export type MockPrepQuestion = {
  id: string;
  question: string;
  intent: string;
  points: string[];
  /** Deprecated — no longer shown in UI. Kept empty for type compat. */
  sampleAnswer: string;
  answerKind: PrepBaseTheme["answerKind"];
};

function toQuestion(theme: PrepBaseTheme): MockPrepQuestion {
  return {
    id: theme.id,
    question: theme.title,
    intent: theme.guidance,
    points: [],
    sampleAnswer: "",
    answerKind: theme.answerKind,
  };
}

/** Always returns the seven base themes (ignores stage kind). */
export function mockQuestionsForStage(
  stageKind?: StageKind | null,
): MockPrepQuestion[] {
  void stageKind;
  return prepBaseThemes().map(toQuestion);
}

export function findMockQuestion(
  stageKind: StageKind | null | undefined,
  questionId: string,
): MockPrepQuestion | null {
  void stageKind;
  const theme = findPrepBaseTheme(questionId);
  return theme ? toQuestion(theme) : null;
}

/** @deprecated UI no longer uses delayed mock generation. */
export const MOCK_ANSWER_DELAY_MS = 450;

export { prepBaseThemes, findPrepBaseTheme, PREP_BASE_THEMES } from "./base-themes";
export type { PrepBaseTheme, PrepAnswerKind } from "./base-themes";
