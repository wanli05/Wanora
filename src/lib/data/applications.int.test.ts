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
});
