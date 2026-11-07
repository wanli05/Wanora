import { and, eq, ne } from "drizzle-orm";
import type { Db } from "@/db";
import {
  applicationStages,
  interviews,
  proposedSlots,
  slotProposals,
} from "@/db/schema";
import type { OfferDecision, Outcome } from "@/lib/progress/enums";
import {
  detectConflicts,
  detectHardInterviewConflict,
  detectSlotPickConflict,
  rawOverlap,
} from "@/lib/progress/conflicts";
import {
  INTERVIEW_MODES,
  MAX_SLOT_COUNT,
  bufferMsForMode,
  type InterviewMode,
} from "@/lib/progress/enums";
import { ProgressError } from "@/lib/progress/errors";
import { canScheduleInterview, currentStage, type StageSnapshot } from "@/lib/progress/stages";
import { getOwnedApplication } from "./applications";
import { loadOccupancyWindows } from "./occupancy";

function isoRange(start: string, end: string) {
  const startsAt = new Date(start);
  const endsAt = new Date(end);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new ProgressError("invalid", "invalid datetime");
  }
  if (!(startsAt < endsAt)) {
    throw new ProgressError("invalid", "end must be after start");
  }
  return { startsAt, endsAt };
}

async function currentInterviewStage(db: Db, userId: string, applicationId: string) {
  const app = await getOwnedApplication(db, userId, applicationId);
  const stageRows = await db
    .select()
    .from(applicationStages)
    .where(
      and(
        eq(applicationStages.applicationId, applicationId),
        eq(applicationStages.userId, userId),
      ),
    );
  const snapshots: StageSnapshot[] = stageRows.map((stage) => ({
    id: stage.id,
    kind: stage.kind as StageSnapshot["kind"],
    customLabel: stage.customLabel,
    position: stage.position,
    status: stage.status as StageSnapshot["status"],
    deadlineAt: stage.deadlineAt?.toISOString() ?? null,
  }));
  const current = currentStage(
    snapshots,
    app.outcome as Outcome,
    (app.offerDecision as OfferDecision | null) ?? null,
  );
  if (!current) throw new ProgressError("invalid", "no current stage");
  return { app, current };
}

export async function createInterview(
  db: Db,
  userId: string,
  applicationId: string,
  input: {
    start: string;
    end: string;
    mode: InterviewMode;
    meetingUrl?: string | null;
    locationText?: string | null;
  },
) {
  if (!INTERVIEW_MODES.includes(input.mode)) {
    throw new ProgressError("invalid", "invalid mode");
  }
  const { current } = await currentInterviewStage(db, userId, applicationId);
  if (!canScheduleInterview(current.kind)) {
    throw new ProgressError("forbidden_stage", "current stage cannot hold an interview");
  }
  const { startsAt, endsAt } = isoRange(input.start, input.end);
  if (input.meetingUrl && !/^https?:\/\//i.test(input.meetingUrl)) {
    throw new ProgressError("invalid", "meeting url must be http(s)");
  }
  const occupancy = await loadOccupancyWindows(db, userId);
  const hit = detectHardInterviewConflict(
    occupancy,
    startsAt.toISOString(),
    endsAt.toISOString(),
    input.mode,
  );
  if (hit) {
    throw new ProgressError("conflict", "interview overlaps another confirmed time", hit);
  }
  const [row] = await db
    .insert(interviews)
    .values({
      userId,
      stageId: current.id,
      startsAt,
      endsAt,
      mode: input.mode,
      meetingUrl: input.meetingUrl?.trim() || null,
      locationText: input.locationText?.trim() || null,
      status: "scheduled",
    })
    .returning();
  await db
    .update(applicationStages)
    .set({ status: "scheduled" })
    .where(and(eq(applicationStages.id, current.id), eq(applicationStages.userId, userId)));
  const released = await releaseOverlappingProposed(db, userId, {
    start: startsAt.toISOString(),
    end: endsAt.toISOString(),
    mode: input.mode,
  });
  return { interview: row, released };
}

export async function updateInterview(
  db: Db,
  userId: string,
  applicationId: string,
  interviewId: string,
  input: {
    start: string;
    end: string;
    mode: InterviewMode;
    meetingUrl?: string | null;
    locationText?: string | null;
  },
) {
  if (!INTERVIEW_MODES.includes(input.mode)) {
    throw new ProgressError("invalid", "invalid mode");
  }
  const app = await getOwnedApplication(db, userId, applicationId);
  const [interview] = await db
    .select()
    .from(interviews)
    .where(and(eq(interviews.id, interviewId), eq(interviews.userId, userId)));
  if (!interview) throw new ProgressError("not_found", "interview not found");
  const [stage] = await db
    .select()
    .from(applicationStages)
    .where(
      and(
        eq(applicationStages.id, interview.stageId),
        eq(applicationStages.applicationId, app.id),
        eq(applicationStages.userId, userId),
      ),
    );
  if (!stage) throw new ProgressError("not_found", "interview not on this application");
  const { startsAt, endsAt } = isoRange(input.start, input.end);
  if (input.meetingUrl && !/^https?:\/\//i.test(input.meetingUrl)) {
    throw new ProgressError("invalid", "meeting url must be http(s)");
  }
  const occupancy = await loadOccupancyWindows(db, userId);
  const hit = detectHardInterviewConflict(
    occupancy,
    startsAt.toISOString(),
    endsAt.toISOString(),
    input.mode,
    new Set([interview.id]),
  );
  if (hit) {
    throw new ProgressError("conflict", "interview overlaps another confirmed time", hit);
  }
  const [row] = await db
    .update(interviews)
    .set({
      startsAt,
      endsAt,
      mode: input.mode,
      meetingUrl: input.meetingUrl?.trim() || null,
      locationText: input.locationText?.trim() || null,
    })
    .where(and(eq(interviews.id, interview.id), eq(interviews.userId, userId)))
    .returning();
  const released = await releaseOverlappingProposed(db, userId, {
    start: startsAt.toISOString(),
    end: endsAt.toISOString(),
    mode: input.mode,
  });
  return { interview: row, released };
}

export async function saveSlotProposal(
  db: Db,
  userId: string,
  applicationId: string,
  input: {
    slots: { start: string; end: string }[];
    status: "draft" | "sent";
    replyDeadlineAt?: string | null;
  },
) {
  if (input.slots.length === 0) {
    throw new ProgressError("invalid", "at least one slot is required");
  }
  if (input.slots.length > MAX_SLOT_COUNT) {
    throw new ProgressError("invalid", "too many slots");
  }
  const { current } = await currentInterviewStage(db, userId, applicationId);
  if (!canScheduleInterview(current.kind)) {
    throw new ProgressError("forbidden_stage", "current stage cannot hold candidate slots");
  }
  const ranges = input.slots.map((slot) => isoRange(slot.start, slot.end));
  for (let i = 0; i < ranges.length; i += 1) {
    for (let j = i + 1; j < ranges.length; j += 1) {
      if (
        rawOverlap(
          ranges[i].startsAt.toISOString(),
          ranges[i].endsAt.toISOString(),
          ranges[j].startsAt.toISOString(),
          ranges[j].endsAt.toISOString(),
        )
      ) {
        throw new ProgressError("conflict", "slots in this proposal overlap");
      }
    }
  }

  const occupancy = await loadOccupancyWindows(db, userId);
  const existing = await db
    .select()
    .from(slotProposals)
    .where(
      and(eq(slotProposals.stageId, current.id), eq(slotProposals.userId, userId)),
    );
  const open = existing.find((row) => row.status === "draft" || row.status === "sent");
  const ignoreIds = new Set<string>();
  if (open) {
    const own = await db
      .select()
      .from(proposedSlots)
      .where(eq(proposedSlots.proposalId, open.id));
    for (const slot of own) ignoreIds.add(slot.id);
  }

  if (input.status === "sent") {
    for (const range of ranges) {
      const hit = detectSlotPickConflict(
        occupancy,
        range.startsAt.toISOString(),
        range.endsAt.toISOString(),
        applicationId,
        ignoreIds,
      );
      if (hit) {
        throw new ProgressError("conflict", "slot overlaps a reserved window", hit);
      }
    }
  } else {
    for (const range of ranges) {
      const hit = detectConflicts(occupancy, range.startsAt.toISOString(), range.endsAt.toISOString(), {
        ignoreIds,
        ignoreApplicationId: applicationId,
        against: ["confirmed", "busy"],
      });
      if (hit) {
        throw new ProgressError("conflict", "slot overlaps a reserved window", hit);
      }
    }
  }

  return db.transaction(async (tx) => {
    let proposalId = open?.id;
    if (!proposalId) {
      const [created] = await tx
        .insert(slotProposals)
        .values({
          userId,
          stageId: current.id,
          status: input.status,
          replyDeadlineAt: input.replyDeadlineAt
            ? new Date(input.replyDeadlineAt)
            : null,
        })
        .returning();
      proposalId = created.id;
    } else {
      await tx
        .update(slotProposals)
        .set({
          status: input.status,
          replyDeadlineAt: input.replyDeadlineAt
            ? new Date(input.replyDeadlineAt)
            : open?.replyDeadlineAt ?? null,
        })
        .where(and(eq(slotProposals.id, proposalId), eq(slotProposals.userId, userId)));
      await tx
        .delete(proposedSlots)
        .where(
          and(eq(proposedSlots.proposalId, proposalId), eq(proposedSlots.userId, userId)),
        );
    }
    await tx.insert(proposedSlots).values(
      ranges.map((range) => ({
        userId,
        proposalId: proposalId!,
        startsAt: range.startsAt,
        endsAt: range.endsAt,
        status: "proposed" as const,
      })),
    );
    return proposalId;
  });
}

export async function confirmProposedSlot(
  db: Db,
  userId: string,
  applicationId: string,
  slotId: string,
  input: { mode?: InterviewMode; meetingUrl?: string | null },
) {
  const { current } = await currentInterviewStage(db, userId, applicationId);
  const [slot] = await db
    .select()
    .from(proposedSlots)
    .where(and(eq(proposedSlots.id, slotId), eq(proposedSlots.userId, userId)));
  if (!slot) throw new ProgressError("not_found", "slot not found");
  const [proposal] = await db
    .select()
    .from(slotProposals)
    .where(and(eq(slotProposals.id, slot.proposalId), eq(slotProposals.userId, userId)));
  if (!proposal || proposal.stageId !== current.id) {
    throw new ProgressError("invalid", "slot is not on the current stage");
  }
  if (proposal.status !== "sent" && proposal.status !== "draft") {
    throw new ProgressError("invalid", "proposal cannot be confirmed");
  }
  const mode = input.mode ?? (proposal.defaultMode as InterviewMode);
  if (input.meetingUrl && !/^https?:\/\//i.test(input.meetingUrl)) {
    throw new ProgressError("invalid", "meeting url must be http(s)");
  }
  const occupancy = await loadOccupancyWindows(db, userId);
  const hit = detectHardInterviewConflict(
    occupancy,
    slot.startsAt.toISOString(),
    slot.endsAt.toISOString(),
    mode,
  );
  if (hit) {
    throw new ProgressError("conflict", "interview overlaps another confirmed time", hit);
  }

  const [interview] = await db
    .insert(interviews)
    .values({
      userId,
      stageId: current.id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      mode,
      meetingUrl: input.meetingUrl?.trim() || null,
      status: "scheduled",
      proposedSlotId: slot.id,
    })
    .returning();
  await db
    .update(proposedSlots)
    .set({ status: "confirmed" })
    .where(eq(proposedSlots.id, slot.id));
  await db
    .update(proposedSlots)
    .set({ status: "released" })
    .where(
      and(
        eq(proposedSlots.proposalId, proposal.id),
        eq(proposedSlots.status, "proposed"),
        ne(proposedSlots.id, slot.id),
      ),
    );
  await db
    .update(slotProposals)
    .set({ status: "confirmed" })
    .where(eq(slotProposals.id, proposal.id));
  await db
    .update(applicationStages)
    .set({ status: "scheduled" })
    .where(and(eq(applicationStages.id, current.id), eq(applicationStages.userId, userId)));

  const released = await releaseOverlappingProposed(db, userId, {
    start: slot.startsAt.toISOString(),
    end: slot.endsAt.toISOString(),
    mode,
    ignoreProposalId: proposal.id,
  });
  return { interview, released };
}

export async function markProposalExpired(
  db: Db,
  userId: string,
  proposalId: string,
) {
  const [proposal] = await db
    .select()
    .from(slotProposals)
    .where(and(eq(slotProposals.id, proposalId), eq(slotProposals.userId, userId)));
  if (!proposal) throw new ProgressError("not_found", "proposal not found");
  await db
    .update(proposedSlots)
    .set({ status: "released" })
    .where(
      and(
        eq(proposedSlots.proposalId, proposalId),
        eq(proposedSlots.status, "proposed"),
      ),
    );
  await db
    .update(slotProposals)
    .set({ status: "expired" })
    .where(eq(slotProposals.id, proposalId));
}

async function releaseOverlappingProposed(
  db: Db,
  userId: string,
  confirmed: {
    start: string;
    end: string;
    mode: InterviewMode;
    ignoreProposalId?: string;
  },
) {
  const occupancy = await loadOccupancyWindows(db, userId);
  const proposed = occupancy.filter((window) => window.kind === "proposed");
  const toRelease = proposed.filter((window) => {
    return Boolean(
      detectConflicts([window], confirmed.start, confirmed.end, {
        candidateBufferMs: bufferMsForMode(confirmed.mode),
        against: ["proposed"],
      }),
    );
  });

  const released: { company: string; start: string; end: string }[] = [];
  for (const window of toRelease) {
    const [slot] = await db
      .select()
      .from(proposedSlots)
      .where(and(eq(proposedSlots.id, window.id), eq(proposedSlots.userId, userId)));
    if (!slot || slot.status !== "proposed") continue;
    if (confirmed.ignoreProposalId && slot.proposalId === confirmed.ignoreProposalId) {
      continue;
    }
    await db
      .update(proposedSlots)
      .set({ status: "released" })
      .where(eq(proposedSlots.id, slot.id));
    released.push({
      company: window.company,
      start: window.start,
      end: window.end,
    });
    const remaining = await db
      .select()
      .from(proposedSlots)
      .where(
        and(
          eq(proposedSlots.proposalId, slot.proposalId),
          eq(proposedSlots.status, "proposed"),
        ),
      );
    if (remaining.length === 0) {
      await db
        .update(slotProposals)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(slotProposals.id, slot.proposalId),
            eq(slotProposals.userId, userId),
          ),
        );
    }
  }
  return released;
}
