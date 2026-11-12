import { DEFAULT_NEXT_PREP, type InterviewMode } from "./enums";
import { currentStage, stageDisplayName, type StageSnapshot } from "./stages";
import { formatTokyoDate } from "./tokyo";
import type { OfferDecision, Outcome } from "./enums";

export type NextPrepInterview = {
  start: string;
  end: string;
  mode: InterviewMode;
  status: "scheduled" | "cancelled";
};

export type NextPrepProposal = {
  status: "draft" | "sent";
  replyDeadlineAt: string | null;
  slotCount: number;
};

/** Short mode label for the join row (Meet/Teams); empty for other modes. */
export function interviewModeLabel(mode: InterviewMode): string {
  if (mode === "google_meet") return "Google Meet";
  if (mode === "teams") return "Microsoft Teams";
  return "";
}

export function deriveNextPrep(input: {
  nextPrepNote: string | null;
  stages: StageSnapshot[];
  outcome: Outcome;
  offerDecision: OfferDecision | null;
  interviews: NextPrepInterview[];
  proposal: NextPrepProposal | null;
  now?: Date;
}): { display: string; derived: string } {
  const derived = derivedSentence(input);
  const note = input.nextPrepNote?.trim();
  return { derived, display: note || derived };
}

function derivedSentence(input: {
  stages: StageSnapshot[];
  outcome: Outcome;
  offerDecision: OfferDecision | null;
  interviews: NextPrepInterview[];
  proposal: NextPrepProposal | null;
  now?: Date;
}): string {
  const now = input.now ?? new Date();
  const stage = currentStage(input.stages, input.outcome, input.offerDecision);
  if (!stage) return "";

  const upcoming = input.interviews.find(
    (interview) =>
      interview.status === "scheduled" && new Date(interview.start) > now,
  );
  if (upcoming) {
    // Time/mode live on the join row — prep line is only the stage name.
    return stageDisplayName(stage);
  }

  if (input.proposal?.status === "sent") {
    return input.proposal.replyDeadlineAt
      ? `候補日程の返信待ち（期限 ${formatTokyoDate(input.proposal.replyDeadlineAt)}）`
      : "候補日程の返信待ち";
  }

  if (input.proposal?.status === "draft") {
    return "候補日程を提出する";
  }

  if (stage.deadlineAt) {
    if (stage.kind === "aptitude_test") {
      return `適性検査を受ける（期限 ${formatTokyoDate(stage.deadlineAt)}）`;
    }
    if (stage.kind === "offer") {
      return `内定への回答（期限 ${formatTokyoDate(stage.deadlineAt)}）`;
    }
    const base = DEFAULT_NEXT_PREP[stage.kind] ?? stageDisplayName(stage);
    return `${base}（期限 ${formatTokyoDate(stage.deadlineAt)}）`;
  }

  if (stage.kind === "offer") {
    return "内定への回答";
  }

  if (stage.kind === "custom") {
    return stageDisplayName(stage);
  }
  return DEFAULT_NEXT_PREP[stage.kind] ?? stageDisplayName(stage);
}
