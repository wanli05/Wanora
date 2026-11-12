import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { GET as getMe } from "@/app/api/me/route";
import { getDb } from "@/db";
import { platforms } from "@/db/schema";
import { BASE_URL, signUp, uniqueEmail } from "../../../test/integration/http";
import { companies } from "@/db/schema";
import {
  advanceApplication,
  createApplication,
  deleteApplication,
  loadBoard,
  updateApplication,
} from "./applications";
import { createInterview, saveSlotProposal, updateInterview } from "./schedule";

async function sessionId(cookie: string): Promise<string> {
  const headers = new Headers({ cookie });
  const res = await getMe(new Request(`${BASE_URL}/api/me`, { headers }));
  const body = await res.json();
  return body.id as string;
}

describe("application board isolation", () => {
  it("keeps each user's applications private", async () => {
    const db = getDb();
    const a = await signUp(uniqueEmail("board-a"));
    const b = await signUp(uniqueEmail("board-b"));
    const [platform] = await db
      .select()
      .from(platforms)
      .where(eq(platforms.code, "doda"));
    const idA = await sessionId(a.cookie);
    const idB = await sessionId(b.cookie);

    await createApplication(db, idA, {
      company: "株式会社A社",
      platformId: platform.id,
    });
    await createApplication(db, idB, {
      company: "株式会社B社",
      platformId: platform.id,
    });

    const boardA = await loadBoard(db, idA);
    const boardB = await loadBoard(db, idB);
    expect(boardA.applications.map((app) => app.company)).toEqual(["株式会社A社"]);
    expect(boardB.applications.map((app) => app.company)).toEqual(["株式会社B社"]);
    expect(boardA.applications[0]?.currentStageKind).toBe("document_screening");
  });

  it("refuses a second confirmed interview that overlaps", async () => {
    const db = getDb();
    const signed = await signUp(uniqueEmail("overlap"));
    const userId = await sessionId(signed.cookie);
    const [platform] = await db
      .select()
      .from(platforms)
      .where(eq(platforms.code, "doda"));
    const first = await createApplication(db, userId, {
      company: "会社いち",
      platformId: platform.id,
      includeInfoSession: true,
    });
    const second = await createApplication(db, userId, {
      company: "会社に",
      platformId: platform.id,
      includeInfoSession: true,
    });
    await createInterview(db, userId, first.id, {
      start: "2026-11-12T14:00:00+09:00",
      end: "2026-11-12T15:00:00+09:00",
      mode: "google_meet",
      meetingUrl: "https://meet.google.com/abc-defg-hij",
    });
    await expect(
      createInterview(db, userId, second.id, {
        start: "2026-11-12T14:30:00+09:00",
        end: "2026-11-12T15:30:00+09:00",
        mode: "teams",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("occupies submitted slots so a second company cannot take them", async () => {
    const db = getDb();
    const signed = await signUp(uniqueEmail("slots"));
    const userId = await sessionId(signed.cookie);
    const [platform] = await db
      .select()
      .from(platforms)
      .where(eq(platforms.code, "doda"));
    const first = await createApplication(db, userId, {
      company: "先に提出",
      platformId: platform.id,
      includeInfoSession: true,
    });
    const second = await createApplication(db, userId, {
      company: "後から",
      platformId: platform.id,
      includeInfoSession: true,
    });
    await saveSlotProposal(db, userId, first.id, {
      status: "sent",
      slots: [
        {
          start: "2026-11-20T10:00:00+09:00",
          end: "2026-11-20T11:00:00+09:00",
        },
      ],
    });
    await expect(
      saveSlotProposal(db, userId, second.id, {
        status: "sent",
        slots: [
          {
            start: "2026-11-20T10:00:00+09:00",
            end: "2026-11-20T11:00:00+09:00",
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("lets the owner rewrite company, notes, and the interview URL after create", async () => {
    const db = getDb();
    const signed = await signUp(uniqueEmail("reedit"));
    const userId = await sessionId(signed.cookie);
    const [platform] = await db
      .select()
      .from(platforms)
      .where(eq(platforms.code, "doda"));
    const app = await createApplication(db, userId, {
      company: "打ち間違え社",
      platformId: platform.id,
      includeInfoSession: true,
    });
    const interview = await createInterview(db, userId, app.id, {
      start: "2026-11-12T14:00:00+09:00",
      end: "2026-11-12T15:00:00+09:00",
      mode: "google_meet",
    });
    await updateApplication(db, userId, app.id, {
      company: "正式社名",
      notes: "URLは後から届いた",
      recruiterName: "佐藤",
    });
    await updateInterview(db, userId, app.id, interview.interview.id, {
      start: "2026-11-12T16:00:00+09:00",
      end: "2026-11-12T17:00:00+09:00",
      mode: "teams",
      meetingUrl: "https://teams.microsoft.com/l/meetup-join/later",
    });
    const board = await loadBoard(db, userId);
    expect(board.applications[0]?.company).toBe("正式社名");
    expect(board.applications[0]?.notes).toBe("URLは後から届いた");
    expect(board.applications[0]?.recruiterName).toBe("佐藤");
    expect(board.applications[0]?.interview?.meetingUrl).toBe(
      "https://teams.microsoft.com/l/meetup-join/later",
    );
    expect(board.applications[0]?.interview?.mode).toBe("teams");
  });

  it("refuses offer from document screening", async () => {
    const db = getDb();
    const signed = await signUp(uniqueEmail("no-offer"));
    const userId = await sessionId(signed.cookie);
    const [platform] = await db
      .select()
      .from(platforms)
      .where(eq(platforms.code, "doda"));
    const app = await createApplication(db, userId, {
      company: "書類の会社",
      platformId: platform.id,
    });
    await expect(
      advanceApplication(db, userId, app.id, "offer"),
    ).rejects.toMatchObject({ code: "forbidden_stage" });
  });

  it("deletes an application and cleans up an orphan company only", async () => {
    const db = getDb();
    const signed = await signUp(uniqueEmail("delete-app"));
    const userId = await sessionId(signed.cookie);
    const [platform] = await db
      .select()
      .from(platforms)
      .where(eq(platforms.code, "doda"));

    const duplicate = await createApplication(db, userId, {
      company: "重複株式会社",
      platformId: platform.id,
    });
    const keep = await createApplication(db, userId, {
      company: "重複株式会社",
      role: "別ライン",
      platformId: platform.id,
    });
    // Same company name reuses the same company row.
    expect(keep.companyId).toBe(duplicate.companyId);

    await deleteApplication(db, userId, duplicate.id);
    const board = await loadBoard(db, userId);
    expect(board.applications.map((app) => app.id)).toEqual([keep.id]);
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, keep.companyId));
    expect(company?.name).toBe("重複株式会社");

    await deleteApplication(db, userId, keep.id);
    const emptyBoard = await loadBoard(db, userId);
    expect(emptyBoard.applications).toHaveLength(0);
    const leftover = await db
      .select()
      .from(companies)
      .where(eq(companies.id, keep.companyId));
    expect(leftover).toHaveLength(0);
  });

  it("rejects the final interview even when a scheduled interview exists", async () => {
    const db = getDb();
    const signed = await signUp(uniqueEmail("final-fail"));
    const userId = await sessionId(signed.cookie);
    const [platform] = await db
      .select()
      .from(platforms)
      .where(eq(platforms.code, "doda"));
    const app = await createApplication(db, userId, {
      company: "最終不合格社",
      platformId: platform.id,
      skipAptitude: true,
      includeSecondInterview: false,
    });
    // Advance: docs → interview_1 → interview_final
    await advanceApplication(db, userId, app.id, "pass");
    await advanceApplication(db, userId, app.id, "pass");
    const beforeInterview = await loadBoard(db, userId);
    expect(beforeInterview.applications[0]?.currentStageKind).toBe("interview_final");
    await createInterview(db, userId, app.id, {
      start: "2026-11-01T14:00:00+09:00",
      end: "2026-11-01T15:00:00+09:00",
      mode: "google_meet",
    });
    await advanceApplication(db, userId, app.id, "reject");
    const board = await loadBoard(db, userId);
    expect(board.applications[0]?.outcome).toBe("rejected");
    // Interview stays scheduled (history); closed cards just leave the in-play column.
    expect(board.applications[0]?.stageInterviews[0]?.status).toBe("scheduled");
    await advanceApplication(db, userId, app.id, "undo");
    const reopened = await loadBoard(db, userId);
    expect(reopened.applications[0]?.outcome).toBe("in_progress");
    expect(reopened.applications[0]?.currentStageKind).toBe("interview_final");
  });

  it("undoes a pass back to the previous stage", async () => {
    const db = getDb();
    const signed = await signUp(uniqueEmail("undo-pass"));
    const userId = await sessionId(signed.cookie);
    const [platform] = await db
      .select()
      .from(platforms)
      .where(eq(platforms.code, "doda"));
    const app = await createApplication(db, userId, {
      company: "取り消し社",
      platformId: platform.id,
    });
    await advanceApplication(db, userId, app.id, "pass");
    expect((await loadBoard(db, userId)).applications[0]?.currentStageKind).toBe(
      "aptitude_test",
    );
    await advanceApplication(db, userId, app.id, "undo");
    expect((await loadBoard(db, userId)).applications[0]?.currentStageKind).toBe(
      "document_screening",
    );
  });

  it("persists a typed custom platform name and reuses it", async () => {
    const db = getDb();
    const signed = await signUp(uniqueEmail("custom-plat"));
    const userId = await sessionId(signed.cookie);

    const first = await createApplication(db, userId, {
      company: "ニッチ社",
      customPlatformName: "Wantedly",
    });
    const board = await loadBoard(db, userId);
    const app = board.applications.find((row) => row.id === first.id);
    expect(app?.platformCode).toBeNull();
    expect(app?.platformName).toBe("Wantedly");
    expect(board.platforms.some((row) => row.name === "Wantedly" && row.code === null)).toBe(
      true,
    );

    await updateApplication(db, userId, first.id, {
      customPlatformName: "Wantedly",
    });
    const again = await loadBoard(db, userId);
    const customRows = again.platforms.filter((row) => row.name === "Wantedly");
    expect(customRows).toHaveLength(1);
  });
});
