import {
  DEFAULT_STAGE_ORDER,
  INTERVIEW_STAGE_KINDS,
  MID_CAREER_SKIPPED,
  type OfferDecision,
  type Outcome,
  type StageKind,
  type StageStatus,
} from "./enums";

export type StageSnapshot = {
  id: string;
  kind: StageKind;
  customLabel: string | null;
  position: number;
  status: StageStatus;
  deadlineAt: string | null;
};

export function midCareerStages(): {
  kind: StageKind;
  status: StageStatus;
  position: number;
}[] {
  return DEFAULT_STAGE_ORDER.map((kind, position) => ({
    kind,
    position,
    status: MID_CAREER_SKIPPED.has(kind) ? "skipped" : "pending",
  }));
}

export function isClosed(
  outcome: Outcome,
  offerDecision: OfferDecision | null,
): boolean {
  if (outcome === "rejected" || outcome === "withdrawn") return true;
  return outcome === "offer" && offerDecision !== "pending";
}

export function currentStage<T extends StageSnapshot>(
  stages: T[],
  outcome: Outcome,
  offerDecision: OfferDecision | null,
): T | undefined {
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  if (outcome === "rejected") {
    return ordered.find((stage) => stage.status === "failed");
  }
  if (outcome === "withdrawn") {
    return ordered.find(
      (stage) => stage.status === "pending" || stage.status === "scheduled",
    );
  }
  if (outcome === "offer" && offerDecision !== "accepted") {
    return ordered.find((stage) => stage.kind === "offer");
  }
  return ordered.find(
    (stage) => stage.status === "pending" || stage.status === "scheduled",
  );
}

export function stageDisplayName(stage: StageSnapshot): string {
  if (stage.kind === "custom") return stage.customLabel ?? "カスタム";
  const names: Record<string, string> = {
    info_session: "説明会",
    document_screening: "書類選考",
    aptitude_test: "適性検査",
    skill_test: "スキルテスト",
    interview_1: "一次面接",
    interview_2: "二次面接",
    interview_final: "最終面接",
    casual_meeting: "カジュアル面談",
    offer: "内定",
  };
  return names[stage.kind] ?? stage.kind;
}

export function canScheduleInterview(kind: StageKind): boolean {
  return INTERVIEW_STAGE_KINDS.has(kind);
}

export function passStages<T extends StageSnapshot>(stages: T[]): T[] {
  const current = currentStage(stages, "in_progress", null);
  if (!current) return stages;
  const next = [...stages].sort((a, b) => a.position - b.position);
  return next.map((stage) =>
    stage.id === current.id ? { ...stage, status: "passed" as const } : stage,
  );
}

export function skipStages<T extends StageSnapshot>(stages: T[]): T[] {
  const current = currentStage(stages, "in_progress", null);
  if (!current) return stages;
  return stages.map((stage) =>
    stage.id === current.id ? { ...stage, status: "skipped" as const } : stage,
  );
}

export function failCurrent<T extends StageSnapshot>(stages: T[]): T[] {
  const current = currentStage(stages, "in_progress", null);
  if (!current) return stages;
  return stages.map((stage) =>
    stage.id === current.id ? { ...stage, status: "failed" as const } : stage,
  );
}

export function jumpToOffer<T extends StageSnapshot>(stages: T[]): T[] {
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  const offer = ordered.find((stage) => stage.kind === "offer");
  return stages.map((stage) => {
    if (stage.kind === "offer") {
      return { ...stage, status: "pending" as const };
    }
    if (
      offer &&
      stage.position < offer.position &&
      (stage.status === "pending" || stage.status === "scheduled")
    ) {
      return { ...stage, status: "skipped" as const };
    }
    return stage;
  });
}

export function outcomeAfterStages<T extends StageSnapshot>(
  stages: T[],
  previous: Outcome,
): { outcome: Outcome; offerDecision: OfferDecision | null } {
  if (previous === "rejected" || previous === "withdrawn") {
    return { outcome: previous, offerDecision: null };
  }
  const current = currentStage(stages, "in_progress", null);
  if (!current || current.kind === "offer") {
    return { outcome: "offer", offerDecision: "pending" };
  }
  return { outcome: "in_progress", offerDecision: null };
}
