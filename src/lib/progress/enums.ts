export const STAGE_KINDS = [
  "info_session",
  "document_screening",
  "aptitude_test",
  "skill_test",
  "interview_1",
  "interview_2",
  "interview_final",
  "casual_meeting",
  "custom",
  "offer",
] as const;

export type StageKind = (typeof STAGE_KINDS)[number];

export const BOARD_COLUMN_KINDS = [
  "info_session",
  "document_screening",
  "aptitude_test",
  "interview_1",
  "interview_2",
  "interview_final",
  "offer",
] as const;

export type BoardColumnKind = (typeof BOARD_COLUMN_KINDS)[number];

export const MID_CAREER_SKIPPED: ReadonlySet<StageKind> = new Set([
  "info_session",
  "interview_2",
]);

export const DEFAULT_STAGE_ORDER: StageKind[] = [
  "info_session",
  "document_screening",
  "aptitude_test",
  "interview_1",
  "interview_2",
  "interview_final",
  "offer",
];

export const INTERVIEW_STAGE_KINDS: ReadonlySet<StageKind> = new Set([
  "info_session",
  "casual_meeting",
  "interview_1",
  "interview_2",
  "interview_final",
]);

export const STAGE_STATUSES = [
  "pending",
  "scheduled",
  "passed",
  "skipped",
  "failed",
] as const;

export type StageStatus = (typeof STAGE_STATUSES)[number];

export const OUTCOMES = [
  "in_progress",
  "rejected",
  "withdrawn",
  "offer",
] as const;

export type Outcome = (typeof OUTCOMES)[number];

export const OFFER_DECISIONS = ["pending", "accepted", "declined"] as const;

export type OfferDecision = (typeof OFFER_DECISIONS)[number];

export const INTERVIEW_MODES = [
  "google_meet",
  "teams",
  "other_online",
  "onsite",
  "phone",
] as const;

export type InterviewMode = (typeof INTERVIEW_MODES)[number];

export const INTERVIEW_STATUSES = ["scheduled", "cancelled"] as const;

export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export const PROPOSAL_STATUSES = [
  "draft",
  "sent",
  "confirmed",
  "expired",
  "cancelled",
] as const;

export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const SLOT_STATUSES = ["proposed", "confirmed", "released"] as const;

export type SlotStatus = (typeof SLOT_STATUSES)[number];

export const PRESET_PLATFORM_CODES = [
  "mynavi_tenshoku",
  "mynavi_shinsotsu",
  "doda",
  "en_tenshoku",
  "linkedin",
  "rikunabi",
  "rikunabi_next",
  "recruit_agent",
  "bizreach",
  "company_direct",
  "referral",
  "other",
] as const;

export type PresetPlatformCode = (typeof PRESET_PLATFORM_CODES)[number];

export const PRESET_PLATFORM_JA: Record<PresetPlatformCode, string> = {
  mynavi_tenshoku: "マイナビ転職",
  mynavi_shinsotsu: "マイナビ（新卒）",
  doda: "Doda",
  en_tenshoku: "えん転職",
  linkedin: "LinkedIn",
  rikunabi: "リクナビ",
  rikunabi_next: "リクナビNEXT",
  recruit_agent: "リクルートエージェント",
  bizreach: "ビズリーチ",
  company_direct: "企業直接応募",
  referral: "リファラル",
  other: "その他",
};

export const DEFAULT_NEXT_PREP: Record<string, string> = {
  info_session: "説明会の準備",
  document_screening: "書類の準備・提出",
  aptitude_test: "適性検査の準備",
  skill_test: "スキルテストの準備",
  interview_1: "一次面接の準備",
  interview_2: "二次面接の準備",
  interview_final: "最終面接の準備",
  casual_meeting: "カジュアル面談の準備",
  offer: "内定条件の確認",
};

export const TOKYO = "Asia/Tokyo";
export const SLOT_HOUR_START = 8;
export const SLOT_HOUR_END = 21;
export const SLOT_STEP_MINUTES = 30;
export const SLOT_DURATION_MS = 60 * 60 * 1000;
export const DEFAULT_SLOT_COUNT = 3;
export const MAX_SLOT_COUNT = 8;
export const ONLINE_BUFFER_MS = 15 * 60 * 1000;
export const ONSITE_BUFFER_MS = 60 * 60 * 1000;

export function bufferMsForMode(mode: InterviewMode): number {
  return mode === "onsite" ? ONSITE_BUFFER_MS : ONLINE_BUFFER_MS;
}
