import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { GET as getMe } from "@/app/api/me/route";
import { getDb } from "@/db";
import { platforms } from "@/db/schema";
import { BASE_URL, signUp, uniqueEmail } from "../../../test/integration/http";
import {
  advanceApplication,
  createApplication,
  loadBoard,
} from "./applications";
import {
  createInterviewFeedback,
  deleteInterviewFeedback,
  updateInterviewFeedback,
} from "./interview-feedbacks";
import { createInterview } from "./schedule";

async function sessionId(cookie: string): Promise<string> {
  const headers = new Headers({ cookie });
  const res = await getMe(new Request(`${BASE_URL}/api/me`, { headers }));
  const body = await res.json();
  return body.id as string;
}

describe("interview feedbacks", () => {
  it("allows multiple feedbacks on one interview and edits by id", async () => {
    const db = getDb();
    const signed = await signUp(uniqueEmail("multi-fb"));
    const userId = await sessionId(signed.cookie);
    const [platform] = await db
      .select()
      .from(platforms)
      .where(eq(platforms.code, "doda"));
    const app = await createApplication(db, userId, {
      company: "複数FB社",
      platformId: platform.id,
      includeInfoSession: true,
    });
    const interview = await createInterview(db, userId, app.id, {
      start: "2026-11-01T14:00:00+09:00",
      end: "2026-11-01T15:00:00+09:00",
      mode: "google_meet",
    });

    const first = await createInterviewFeedback(db, userId, interview.interview.id, {
      source: "company",
      body: "会社からのフィードバック",
      recordedOn: "2026-11-01",
    });
    const second = await createInterviewFeedback(db, userId, interview.interview.id, {
      source: "recruiter",
      body: "エージェントからのフィードバック",
      recordedOn: "2026-11-02",
    });
    expect(first.id).not.toBe(second.id);

    await updateInterviewFeedback(db, userId, first.id, {
      source: "company",
      body: "会社フィードバック更新",
      recordedOn: "2026-11-01",
    });

    const board = await loadBoard(db, userId);
    const stageInterview = board.applications[0]?.stageInterviews[0];
    expect(stageInterview?.feedbacks).toHaveLength(2);
    expect(stageInterview?.feedbacks.map((item) => item.body)).toEqual([
      "会社フィードバック更新",
      "エージェントからのフィードバック",
    ]);
    expect(board.applications[0]?.hasFeedback).toBe(true);

    await deleteInterviewFeedback(db, userId, second.id);
    const afterDelete = await loadBoard(db, userId);
    expect(afterDelete.applications[0]?.stageInterviews[0]?.feedbacks).toHaveLength(1);
  });

  it("keeps feedbacks editable after rejecting a stage with a scheduled interview", async () => {
    const db = getDb();
    const signed = await signUp(uniqueEmail("fb-after-fail"));
    const userId = await sessionId(signed.cookie);
    const [platform] = await db
      .select()
      .from(platforms)
      .where(eq(platforms.code, "doda"));
    const app = await createApplication(db, userId, {
      company: "落選後FB社",
      platformId: platform.id,
      includeInfoSession: true,
    });
    const interview = await createInterview(db, userId, app.id, {
      start: "2026-11-01T10:00:00+09:00",
      end: "2026-11-01T11:00:00+09:00",
      mode: "onsite",
    });
    await createInterviewFeedback(db, userId, interview.interview.id, {
      source: "self",
      body: "自己振り返り",
      recordedOn: "2026-11-01",
    });
    await advanceApplication(db, userId, app.id, "reject");
    const board = await loadBoard(db, userId);
    expect(board.applications[0]?.outcome).toBe("rejected");
    const kept = board.applications[0]?.stageInterviews.find(
      (item) => item.id === interview.interview.id,
    );
    expect(kept?.status).toBe("scheduled");
    expect(kept?.feedbacks).toHaveLength(1);
    expect(kept?.canWriteFeedback).toBe(true);
  });
});
