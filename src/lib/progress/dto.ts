import type { OccupancyWindow } from "./conflicts";
import type {
  FeedbackSource,
  InterviewMode,
  InterviewStatus,
  OfferDecision,
  Outcome,
  PresetPlatformCode,
  ProposalStatus,
  SlotStatus,
  StageKind,
  StageStatus,
} from "./enums";

export type BoardPlatform = {
  id: string;
  code: PresetPlatformCode | null;
  name: string | null;
};

export type BoardRecruiter = {
  id: string;
  name: string;
  platformId: string;
  isActive: boolean;
};

export type BoardStage = {
  id: string;
  kind: StageKind;
  customLabel: string | null;
  position: number;
  status: StageStatus;
  deadlineAt: string | null;
};

export type BoardInterview = {
  id: string;
  start: string;
  end: string;
  mode: InterviewMode;
  meetingUrl: string | null;
  locationText: string | null;
  status: InterviewStatus;
};

export type BoardFeedback = {
  id: string;
  interviewId: string;
  source: FeedbackSource;
  body: string | null;
  rating: number | null;
  recordedOn: string;
  summary: string;
};

export type BoardStageInterview = BoardInterview & {
  stageId: string;
  stageKind: StageKind;
  canWriteFeedback: boolean;
  feedback: BoardFeedback | null;
};

export type BoardJobPosting = {
  jobUrl: string | null;
  salaryBandText: string | null;
  benefitsText: string | null;
  jdText: string | null;
  processNotes: string | null;
  workLocationText: string | null;
  jobNotes: string | null;
};

export type BoardSlot = {
  id: string;
  start: string;
  end: string;
  status: SlotStatus;
};

export type BoardProposal = {
  id: string;
  status: ProposalStatus;
  replyDeadlineAt: string | null;
  slots: BoardSlot[];
};

export type BoardApplication = {
  id: string;
  company: string;
  companyId: string;
  companyUrl: string | null;
  companyNotes: string | null;
  role: string | null;
  platformId: string;
  platformCode: PresetPlatformCode | null;
  platformName: string | null;
  recruiterId: string | null;
  recruiterName: string | null;
  appliedOn: string;
  notes: string | null;
  jobPosting: BoardJobPosting;
  hasJobPosting: boolean;
  hasFeedback: boolean;
  outcome: Outcome;
  offerDecision: OfferDecision | null;
  nextPrepNote: string | null;
  nextPrep: string;
  derivedNextPrep: string;
  currentStageKind: StageKind | null;
  currentStageId: string | null;
  conflict: boolean;
  interview: BoardInterview | null;
  stageInterviews: BoardStageInterview[];
  proposal: BoardProposal | null;
  stages: BoardStage[];
};

export type BoardPayload = {
  platforms: BoardPlatform[];
  recruiters: BoardRecruiter[];
  applications: BoardApplication[];
  occupancy: OccupancyWindow[];
};
