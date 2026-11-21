import type { BoardApplication, BoardStage } from "@/lib/progress/dto";
import { INTERVIEW_STAGE_KINDS } from "@/lib/progress/enums";
import { stageDisplayName } from "@/lib/progress/stages";
import type { InterviewPrepRound } from "./types";

function isActiveInterview(
  interview: InterviewPrepRound["interviews"][number],
): boolean {
  return interview.status !== "cancelled";
}

/** Interview-capable stages that are not skipped — may have zero interviews (面接未定). */
export function buildPrepRounds(app: BoardApplication): InterviewPrepRound[] {
  const stages = app.stages
    .filter(
      (stage) =>
        INTERVIEW_STAGE_KINDS.has(stage.kind) && stage.status !== "skipped",
    )
    .slice()
    .sort((a, b) => a.position - b.position);

  return stages.map((stage) => {
    const interviews = app.stageInterviews
      .filter((item) => item.stageId === stage.id)
      .slice()
      .sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
      );
    const active = interviews.filter(isActiveInterview);
    return {
      stageId: stage.id,
      stageKind: stage.kind,
      customLabel: stage.customLabel,
      status: stage.status,
      label: stageDisplayName({
        id: stage.id,
        kind: stage.kind,
        customLabel: stage.customLabel,
        position: stage.position,
        status: stage.status,
        deadlineAt: stage.deadlineAt,
      }),
      interviews,
      schedulePending: active.length === 0,
    };
  });
}

/**
 * Prefer the stage that owns the next upcoming scheduled interview;
 * else the current interview-capable stage; else the first round.
 * Never invents interview rows.
 */
export function pickDefaultRoundId(
  rounds: InterviewPrepRound[],
  app: Pick<BoardApplication, "currentStageId">,
  now: Date = new Date(),
): string | null {
  if (rounds.length === 0) return null;

  const upcoming = rounds
    .flatMap((round) =>
      round.interviews
        .filter(
          (item) =>
            item.status === "scheduled" && new Date(item.start).getTime() > now.getTime(),
        )
        .map((item) => ({ stageId: round.stageId, start: item.start })),
    )
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  if (upcoming[0]) return upcoming[0].stageId;

  if (
    app.currentStageId &&
    rounds.some((round) => round.stageId === app.currentStageId)
  ) {
    return app.currentStageId;
  }

  return rounds[0]?.stageId ?? null;
}

export function summarizeRoundSchedule(
  round: InterviewPrepRound | null,
  now: Date = new Date(),
): { kind: "upcoming" | "scheduled_past" | "unscheduled"; interviewId?: string } {
  if (!round || round.schedulePending) {
    return { kind: "unscheduled" };
  }
  const scheduled = round.interviews.filter((item) => item.status === "scheduled");
  const upcoming = scheduled
    .filter((item) => new Date(item.start).getTime() > now.getTime())
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  if (upcoming[0]) {
    return { kind: "upcoming", interviewId: upcoming[0].id };
  }
  const past = scheduled
    .slice()
    .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
  if (past[0]) {
    return { kind: "scheduled_past", interviewId: past[0].id };
  }
  return { kind: "unscheduled" };
}

/** @internal test helper — build a minimal BoardStage-compatible object */
export function stageForTest(partial: Partial<BoardStage> & Pick<BoardStage, "id" | "kind" | "position" | "status">): BoardStage {
  return {
    customLabel: null,
    deadlineAt: null,
    ...partial,
  };
}
