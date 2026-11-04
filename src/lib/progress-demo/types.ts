export const STAGE_KINDS = [
  "info_session",
  "document_screening",
  "aptitude_test",
  "interview_1",
  "interview_2",
  "interview_final",
  "offer",
] as const;

export type StageKind = (typeof STAGE_KINDS)[number];

export type StageStatus =
  | "pending"
  | "scheduled"
  | "passed"
  | "skipped"
  | "failed";

export type Outcome = "in_progress" | "rejected" | "withdrawn" | "offer";

export type OfferDecision = "pending" | "accepted" | "declined";

export type InterviewMode =
  | "google_meet"
  | "teams"
  | "other_online"
  | "onsite"
  | "phone";

export type Interview = {
  id: string;
  start: string;
  end: string;
  mode: InterviewMode;
  meetingUrl?: string;
  locationText?: string;
  status: "scheduled" | "cancelled";
};

export type ProposedSlot = {
  id: string;
  start: string;
  end: string;
};

export type Stage = {
  id: string;
  kind: StageKind;
  customName?: string;
  status: StageStatus;
  deadline?: string;
  interviews: Interview[];
  proposedSlots?: ProposedSlot[];
};

export type SlotConflictKind = "confirmed" | "proposed";

export type SlotConflict = {
  kind: SlotConflictKind;
  otherCompany: string;
  otherStart: string;
  otherEnd: string;
};

export type Application = {
  id: string;
  company: string;
  role?: string;
  platform: string;
  recruiter: string | null;
  appliedAt: string;
  outcome: Outcome;
  offerDecision?: OfferDecision | null;
  nextPrepNote?: string;
  stages: Stage[];
};

export type ConflictHit = {
  otherCompany: string;
  otherStart: string;
};
