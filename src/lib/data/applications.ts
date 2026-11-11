import { and, eq, isNull, or } from "drizzle-orm";
import type { Db } from "@/db";
import {
  applicationStages,
  applications,
  companies,
  interviews,
  platforms,
  proposedSlots,
  recruiters,
  slotProposals,
} from "@/db/schema";
import type { BoardApplication, BoardPayload } from "@/lib/progress/dto";
import type { InterviewMode, OfferDecision, Outcome, StageKind } from "@/lib/progress/enums";
import { ProgressError } from "@/lib/progress/errors";
import { deriveNextPrep } from "@/lib/progress/next-prep";
import {
  currentStage,
  failCurrent,
  isAdvanceActionAllowed,
  isClosed,
  jumpToOffer,
  midCareerStages,
  outcomeAfterStages,
  passStages,
  skipStages,
  type AdvanceAction,
  type StageSnapshot,
} from "@/lib/progress/stages";
import { tokyoTodayKey } from "@/lib/progress/tokyo";
import { detectHardInterviewConflict } from "@/lib/progress/conflicts";
import { findOrCreateCompany } from "./companies";
import { loadOccupancyWindows } from "./occupancy";
import { resolvePlatformId } from "./platforms";
import { findOrCreateRecruiter, getOwnedRecruiter } from "./recruiters";

export async function createApplication(
  db: Db,
  userId: string,
  input: {
    company: string;
    role?: string;
    platformId?: string;
    customPlatformName?: string | null;
    recruiterId?: string | null;
    recruiterName?: string | null;
    appliedOn?: string;
    includeInfoSession?: boolean;
    includeSecondInterview?: boolean;
    skipAptitude?: boolean;
  },
) {
  const platformId = await resolvePlatformId(db, userId, {
    platformId: input.platformId,
    customPlatformName: input.customPlatformName,
  });
  let recruiterId = input.recruiterId ?? null;
  if (input.recruiterName !== undefined) {
    const name = input.recruiterName?.trim() ?? "";
    recruiterId = name
      ? (await findOrCreateRecruiter(db, userId, { platformId, name })).id
      : null;
  }
  if (recruiterId) {
    const recruiter = await getOwnedRecruiter(db, userId, recruiterId);
    if (recruiter.platformId !== platformId) {
      throw new ProgressError("invalid", "recruiter does not belong to platform");
    }
    if (!recruiter.isActive) {
      throw new ProgressError("invalid", "recruiter is inactive");
    }
  }

  const company = await findOrCreateCompany(db, userId, input.company);
  const appliedOn = input.appliedOn ?? tokyoTodayKey();
  const template = midCareerStages().map((stage) => {
    if (stage.kind === "info_session" && input.includeInfoSession) {
      return { ...stage, status: "pending" as const };
    }
    if (stage.kind === "interview_2" && input.includeSecondInterview) {
      return { ...stage, status: "pending" as const };
    }
    if (stage.kind === "aptitude_test" && input.skipAptitude) {
      return { ...stage, status: "skipped" as const };
    }
    return stage;
  });

  return db.transaction(async (tx) => {
    const [app] = await tx
      .insert(applications)
      .values({
        userId,
        companyId: company.id,
        platformId,
        recruiterId,
        jobTitle: input.role?.trim() || null,
        appliedOn,
      })
      .returning();
    await tx.insert(applicationStages).values(
      template.map((stage) => ({
        userId,
        applicationId: app.id,
        kind: stage.kind,
        position: stage.position,
        status: stage.status,
      })),
    );
    return app;
  });
}

export async function loadBoard(db: Db, userId: string): Promise<BoardPayload> {
  const [
    platformRows,
    recruiterRows,
    appRows,
    stageRows,
    interviewRows,
    proposalRows,
    slotRows,
    occupancy,
  ] = await Promise.all([
    db
      .select()
      .from(platforms)
      .where(
        or(isNull(platforms.userId), eq(platforms.userId, userId)),
      ),
    db.select().from(recruiters).where(eq(recruiters.userId, userId)),
    db
      .select({
        app: applications,
        companyName: companies.name,
        platformCode: platforms.code,
        platformName: platforms.name,
        recruiterName: recruiters.name,
      })
      .from(applications)
      .innerJoin(companies, eq(companies.id, applications.companyId))
      .innerJoin(platforms, eq(platforms.id, applications.platformId))
      .leftJoin(recruiters, eq(recruiters.id, applications.recruiterId))
      .where(eq(applications.userId, userId)),
    db.select().from(applicationStages).where(eq(applicationStages.userId, userId)),
    db.select().from(interviews).where(eq(interviews.userId, userId)),
    db.select().from(slotProposals).where(eq(slotProposals.userId, userId)),
    db.select().from(proposedSlots).where(eq(proposedSlots.userId, userId)),
    loadOccupancyWindows(db, userId),
  ]);

  const visiblePlatforms = platformRows.filter(
    (row) => row.userId === null || row.userId === userId,
  );

  const stagesByApp = new Map<string, typeof stageRows>();
  for (const stage of stageRows) {
    const list = stagesByApp.get(stage.applicationId) ?? [];
    list.push(stage);
    stagesByApp.set(stage.applicationId, list);
  }

  const interviewsByStage = new Map<string, typeof interviewRows>();
  for (const interview of interviewRows) {
    const list = interviewsByStage.get(interview.stageId) ?? [];
    list.push(interview);
    interviewsByStage.set(interview.stageId, list);
  }

  const proposalsByStage = new Map<string, typeof proposalRows>();
  for (const proposal of proposalRows) {
    const list = proposalsByStage.get(proposal.stageId) ?? [];
    list.push(proposal);
    proposalsByStage.set(proposal.stageId, list);
  }

  const slotsByProposal = new Map<string, typeof slotRows>();
  for (const slot of slotRows) {
    const list = slotsByProposal.get(slot.proposalId) ?? [];
    list.push(slot);
    slotsByProposal.set(slot.proposalId, list);
  }

  const mapped: BoardApplication[] = appRows.map((row) => {
    const stages = (stagesByApp.get(row.app.id) ?? []).map((stage) => ({
      id: stage.id,
      kind: stage.kind as StageKind,
      customLabel: stage.customLabel,
      position: stage.position,
      status: stage.status as StageSnapshot["status"],
      deadlineAt: stage.deadlineAt?.toISOString() ?? null,
    }));
    const current = currentStage(
      stages,
      row.app.outcome as Outcome,
      (row.app.offerDecision as OfferDecision | null) ?? null,
    );
    const stageInterviews = current
      ? (interviewsByStage.get(current.id) ?? []).filter(
          (item) => item.status === "scheduled",
        )
      : [];
    const interview = stageInterviews[0];
    const openProposal = current
      ? (proposalsByStage.get(current.id) ?? []).find(
          (item) => item.status === "draft" || item.status === "sent",
        )
      : undefined;
    const proposalSlots = openProposal
      ? (slotsByProposal.get(openProposal.id) ?? []).filter(
          (slot) => slot.status === "proposed",
        )
      : [];
    const nextPrep = deriveNextPrep({
      nextPrepNote: row.app.nextPrepNote,
      stages,
      outcome: row.app.outcome as Outcome,
      offerDecision: (row.app.offerDecision as OfferDecision | null) ?? null,
      interviews: stageInterviews.map((item) => ({
        start: item.startsAt.toISOString(),
        end: item.endsAt.toISOString(),
        mode: item.mode as InterviewMode,
        status: "scheduled",
      })),
      proposal: openProposal
        ? {
            status: openProposal.status as "draft" | "sent",
            replyDeadlineAt: openProposal.replyDeadlineAt?.toISOString() ?? null,
            slotCount: proposalSlots.length,
          }
        : null,
    });
    const conflict = Boolean(
      interview &&
        detectHardInterviewConflict(
          occupancy,
          interview.startsAt.toISOString(),
          interview.endsAt.toISOString(),
          interview.mode as InterviewMode,
          new Set([interview.id]),
        ),
    );
    return {
      id: row.app.id,
      company: row.companyName,
      companyId: row.app.companyId,
      role: row.app.jobTitle,
      platformId: row.app.platformId,
      platformCode: row.platformCode as BoardApplication["platformCode"],
      platformName: row.platformName,
      recruiterId: row.app.recruiterId,
      recruiterName: row.recruiterName,
      appliedOn: row.app.appliedOn,
      notes: row.app.notes,
      outcome: row.app.outcome as Outcome,
      offerDecision: (row.app.offerDecision as OfferDecision | null) ?? null,
      nextPrepNote: row.app.nextPrepNote,
      nextPrep: nextPrep.display,
      derivedNextPrep: nextPrep.derived,
      currentStageKind: current?.kind ?? null,
      currentStageId: current?.id ?? null,
      conflict,
      interview: interview
        ? {
            id: interview.id,
            start: interview.startsAt.toISOString(),
            end: interview.endsAt.toISOString(),
            mode: interview.mode as InterviewMode,
            meetingUrl: interview.meetingUrl,
            locationText: interview.locationText,
            status: "scheduled",
          }
        : null,
      proposal: openProposal
        ? {
            id: openProposal.id,
            status: openProposal.status as "draft" | "sent",
            replyDeadlineAt: openProposal.replyDeadlineAt?.toISOString() ?? null,
            slots: proposalSlots.map((slot) => ({
              id: slot.id,
              start: slot.startsAt.toISOString(),
              end: slot.endsAt.toISOString(),
              status: "proposed" as const,
            })),
          }
        : null,
      stages,
    };
  });

  return {
    platforms: visiblePlatforms.map((row) => ({
      id: row.id,
      code: row.code as BoardApplication["platformCode"],
      name: row.name,
    })),
    recruiters: recruiterRows.map((row) => ({
      id: row.id,
      name: row.name,
      platformId: row.platformId,
      isActive: row.isActive,
    })),
    applications: mapped,
    occupancy,
  };
}

export async function updateApplication(
  db: Db,
  userId: string,
  applicationId: string,
  input: {
    company?: string;
    role?: string | null;
    platformId?: string;
    customPlatformName?: string | null;
    recruiterId?: string | null;
    recruiterName?: string | null;
    notes?: string | null;
    appliedOn?: string;
    nextPrepNote?: string | null;
  },
) {
  const app = await getOwnedApplication(db, userId, applicationId);
  const patch: {
    companyId?: string;
    jobTitle?: string | null;
    platformId?: string;
    recruiterId?: string | null;
    notes?: string | null;
    appliedOn?: string;
    nextPrepNote?: string | null;
  } = {};

  if (input.company !== undefined) {
    const company = await findOrCreateCompany(db, userId, input.company);
    patch.companyId = company.id;
  }
  if (input.role !== undefined) {
    patch.jobTitle = input.role?.trim() || null;
  }
  if (input.notes !== undefined) {
    patch.notes = input.notes?.trim() || null;
  }
  if (input.appliedOn !== undefined) {
    patch.appliedOn = input.appliedOn;
  }
  if (input.nextPrepNote !== undefined) {
    patch.nextPrepNote = input.nextPrepNote;
  }

  let platformId = app.platformId;
  if (input.customPlatformName !== undefined || input.platformId !== undefined) {
    platformId = await resolvePlatformId(db, userId, {
      platformId: input.platformId ?? app.platformId,
      customPlatformName: input.customPlatformName,
    });
    patch.platformId = platformId;
  }

  if (input.recruiterName !== undefined) {
    const name = input.recruiterName?.trim() ?? "";
    patch.recruiterId = name
      ? (await findOrCreateRecruiter(db, userId, { platformId, name })).id
      : null;
  } else if (input.recruiterId !== undefined) {
    const recruiterId = input.recruiterId;
    if (recruiterId) {
      const recruiter = await getOwnedRecruiter(db, userId, recruiterId);
      if (recruiter.platformId !== platformId) {
        throw new ProgressError("invalid", "recruiter does not belong to platform");
      }
      patch.recruiterId = recruiter.id;
    } else {
      patch.recruiterId = null;
    }
  } else if (input.platformId !== undefined && app.recruiterId) {
    const recruiter = await getOwnedRecruiter(db, userId, app.recruiterId);
    if (recruiter.platformId !== platformId) {
      patch.recruiterId = null;
    }
  }

  if (Object.keys(patch).length === 0) return app;
  const [updated] = await db
    .update(applications)
    .set(patch)
    .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
    .returning();
  return updated;
}

export async function getOwnedApplication(db: Db, userId: string, id: string) {
  const [row] = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, id), eq(applications.userId, userId)));
  if (!row) throw new ProgressError("not_found", "application not found");
  return row;
}

export async function deleteApplication(
  db: Db,
  userId: string,
  applicationId: string,
) {
  const app = await getOwnedApplication(db, userId, applicationId);
  const companyId = app.companyId;

  await db
    .delete(applications)
    .where(
      and(eq(applications.id, applicationId), eq(applications.userId, userId)),
    );

  const [sibling] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(
      and(eq(applications.companyId, companyId), eq(applications.userId, userId)),
    )
    .limit(1);

  if (!sibling) {
    await db
      .delete(companies)
      .where(and(eq(companies.id, companyId), eq(companies.userId, userId)));
  }
}

async function cancelOpenProposals(
  db: Db,
  userId: string,
  stageIds: string[],
) {
  if (stageIds.length === 0) return;
  for (const stageId of stageIds) {
    const open = await db
      .select()
      .from(slotProposals)
      .where(
        and(
          eq(slotProposals.userId, userId),
          eq(slotProposals.stageId, stageId),
        ),
      );
    for (const proposal of open) {
      if (proposal.status !== "draft" && proposal.status !== "sent") continue;
      await db
        .update(proposedSlots)
        .set({ status: "released" })
        .where(
          and(
            eq(proposedSlots.proposalId, proposal.id),
            eq(proposedSlots.userId, userId),
            eq(proposedSlots.status, "proposed"),
          ),
        );
      await db
        .update(slotProposals)
        .set({ status: "cancelled" })
        .where(eq(slotProposals.id, proposal.id));
    }
  }
}

export async function advanceApplication(
  db: Db,
  userId: string,
  applicationId: string,
  action:
    | "pass"
    | "skip"
    | "reject"
    | "withdraw"
    | "offer"
    | "accept_offer"
    | "decline_offer"
    | "reopen",
) {
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
    kind: stage.kind as StageKind,
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

  if (action === "reopen") {
    if (!isClosed(app.outcome as Outcome, app.offerDecision as OfferDecision | null)) {
      throw new ProgressError("invalid", "application is not closed");
    }
    const nextStages =
      app.outcome === "rejected"
        ? snapshots.map((stage) =>
            stage.status === "failed" ? { ...stage, status: "pending" as const } : stage,
          )
        : snapshots;
    await persistStages(db, userId, nextStages);
    await db
      .update(applications)
      .set({ outcome: "in_progress", offerDecision: null })
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)));
    return;
  }

  if (isClosed(app.outcome as Outcome, app.offerDecision as OfferDecision | null)) {
    throw new ProgressError("invalid", "application is closed");
  }

  if (
    action === "pass" ||
    action === "skip" ||
    action === "reject" ||
    action === "withdraw" ||
    action === "offer"
  ) {
    if (!isAdvanceActionAllowed(current?.kind, action as AdvanceAction)) {
      throw new ProgressError("forbidden_stage", "action is not allowed on this stage");
    }
  }

  if (action === "accept_offer" || action === "decline_offer") {
    if (app.outcome !== "offer") {
      throw new ProgressError("invalid", "not an offer");
    }
    await db
      .update(applications)
      .set({
        offerDecision: action === "accept_offer" ? "accepted" : "declined",
      })
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)));
    return;
  }

  if (current) {
    const scheduledOnCurrent = await db
      .select()
      .from(interviews)
      .where(
        and(
          eq(interviews.stageId, current.id),
          eq(interviews.userId, userId),
          eq(interviews.status, "scheduled"),
        ),
      );
    if (
      (action === "skip" || action === "reject" || action === "withdraw") &&
      scheduledOnCurrent.length > 0
    ) {
      throw new ProgressError(
        "forbidden_stage",
        "cancel the scheduled interview before skipping or closing this stage",
      );
    }
    await cancelOpenProposals(db, userId, [current.id]);
  }

  let nextStages = snapshots;
  let outcome: Outcome = app.outcome as Outcome;
  let offerDecision = (app.offerDecision as OfferDecision | null) ?? null;

  if (action === "pass") {
    nextStages = passStages(snapshots);
    const next = outcomeAfterStages(nextStages, "in_progress");
    outcome = next.outcome;
    offerDecision = next.offerDecision;
  } else if (action === "skip") {
    nextStages = skipStages(snapshots);
    const next = outcomeAfterStages(nextStages, "in_progress");
    outcome = next.outcome;
    offerDecision = next.offerDecision;
  } else if (action === "reject") {
    nextStages = failCurrent(snapshots);
    outcome = "rejected";
    offerDecision = null;
  } else if (action === "withdraw") {
    outcome = "withdrawn";
    offerDecision = null;
  } else if (action === "offer") {
    nextStages = jumpToOffer(snapshots);
    outcome = "offer";
    offerDecision = "pending";
  }

  await persistStages(db, userId, nextStages);
  await db
    .update(applications)
    .set({ outcome, offerDecision })
    .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)));
}

async function persistStages(db: Db, userId: string, stages: StageSnapshot[]) {
  for (const stage of stages) {
    await db
      .update(applicationStages)
      .set({ status: stage.status })
      .where(and(eq(applicationStages.id, stage.id), eq(applicationStages.userId, userId)));
  }
}

export async function updateApplicationNote(
  db: Db,
  userId: string,
  applicationId: string,
  nextPrepNote: string | null,
) {
  await getOwnedApplication(db, userId, applicationId);
  await db
    .update(applications)
    .set({ nextPrepNote })
    .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)));
}
