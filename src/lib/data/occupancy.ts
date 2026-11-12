import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import {
  applicationStages,
  applications,
  busyBlocks,
  companies,
  interviews,
  proposedSlots,
  slotProposals,
} from "@/db/schema";
import type { OccupancyWindow } from "@/lib/progress/conflicts";
import type { InterviewMode } from "@/lib/progress/enums";

export async function loadOccupancyWindows(
  db: Db,
  userId: string,
): Promise<OccupancyWindow[]> {
  const [scheduled, proposed, busy] = await Promise.all([
    db
      .select({
        id: interviews.id,
        start: interviews.startsAt,
        end: interviews.endsAt,
        mode: interviews.mode,
        applicationId: applications.id,
        company: companies.name,
      })
      .from(interviews)
      .innerJoin(applicationStages, eq(applicationStages.id, interviews.stageId))
      .innerJoin(
        applications,
        eq(applications.id, applicationStages.applicationId),
      )
      .innerJoin(companies, eq(companies.id, applications.companyId))
      .where(
        and(eq(interviews.userId, userId), eq(interviews.status, "scheduled")),
      ),
    db
      .select({
        id: proposedSlots.id,
        start: proposedSlots.startsAt,
        end: proposedSlots.endsAt,
        applicationId: applications.id,
        company: companies.name,
      })
      .from(proposedSlots)
      .innerJoin(slotProposals, eq(slotProposals.id, proposedSlots.proposalId))
      .innerJoin(applicationStages, eq(applicationStages.id, slotProposals.stageId))
      .innerJoin(
        applications,
        eq(applications.id, applicationStages.applicationId),
      )
      .innerJoin(companies, eq(companies.id, applications.companyId))
      .where(
        and(
          eq(proposedSlots.userId, userId),
          eq(proposedSlots.status, "proposed"),
          eq(slotProposals.status, "sent"),
        ),
      ),
    db.select().from(busyBlocks).where(eq(busyBlocks.userId, userId)),
  ]);

  return [
    ...scheduled.map((row) => ({
      id: row.id,
      kind: "confirmed" as const,
      company: row.company,
      start: row.start.toISOString(),
      end: row.end.toISOString(),
      mode: row.mode as InterviewMode,
      applicationId: row.applicationId,
    })),
    ...proposed.map((row) => ({
      id: row.id,
      kind: "proposed" as const,
      company: row.company,
      start: row.start.toISOString(),
      end: row.end.toISOString(),
      applicationId: row.applicationId,
    })),
    ...busy.map((row) => ({
      id: row.id,
      kind: "busy" as const,
      company: row.label ?? "",
      start: row.startsAt.toISOString(),
      end: row.endsAt.toISOString(),
    })),
  ];
}
