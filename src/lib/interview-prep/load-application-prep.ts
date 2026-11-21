import type { Db } from "@/db";
import { loadBoard } from "@/lib/data/applications";
import { buildPrepRounds, pickDefaultRoundId } from "./rounds";
import type { InterviewPrepApplication } from "./types";

/**
 * Read-only prep payload for one owned application.
 * Reuses `loadBoard` mapping (no schema change, no interview/feedback writes).
 * Returns `null` when the application is missing or not owned by `userId`.
 */
export async function loadApplicationPrep(
  db: Db,
  userId: string,
  applicationId: string,
  now: Date = new Date(),
): Promise<InterviewPrepApplication | null> {
  const board = await loadBoard(db, userId);
  const app = board.applications.find((item) => item.id === applicationId);
  if (!app) return null;

  const rounds = buildPrepRounds(app);
  return {
    id: app.id,
    company: app.company,
    role: app.role,
    companyNotes: app.companyNotes,
    jobPosting: app.jobPosting,
    currentStageKind: app.currentStageKind,
    currentStageId: app.currentStageId,
    rounds,
    initialRoundId: pickDefaultRoundId(rounds, app, now),
  };
}
