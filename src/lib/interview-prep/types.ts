import type {
  BoardJobPosting,
  BoardStageInterview,
} from "@/lib/progress/dto";
import type { StageKind, StageStatus } from "@/lib/progress/enums";

/** One selectable prep round — an interview-capable stage, with or without scheduled interviews. */
export type InterviewPrepRound = {
  stageId: string;
  stageKind: StageKind;
  customLabel: string | null;
  status: StageStatus;
  label: string;
  /** Existing interview rows for this stage (may be empty — 面接未定). */
  interviews: BoardStageInterview[];
  /** True when no non-cancelled interview is scheduled/recorded on this stage. */
  schedulePending: boolean;
};

export type InterviewPrepApplication = {
  id: string;
  company: string;
  role: string | null;
  companyNotes: string | null;
  jobPosting: BoardJobPosting;
  currentStageKind: StageKind | null;
  currentStageId: string | null;
  rounds: InterviewPrepRound[];
  /** Default round to select; null only when no interview-capable stages exist. */
  initialRoundId: string | null;
};
