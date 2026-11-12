import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb } from "@/db";
import {
  accounts,
  applicationStages,
  applications,
  companies,
  interviews,
  platforms,
  sessions,
  users,
} from "./schema";

function newUser(overrides: Partial<typeof users.$inferInsert> = {}) {
  return {
    id: randomUUID(),
    name: "Schema Test",
    email: `${randomUUID()}@example.test`,
    ...overrides,
  };
}

describe("database schema (migrations applied)", () => {
  it("creates the auth tables", async () => {
    const result = await getDb().execute<{ table_name: string }>(sql`
      select table_name from information_schema.tables
      where table_schema = 'public' order by table_name`);
    expect(result.rows.map((r) => r.table_name)).toEqual(
      expect.arrayContaining([
        "accounts",
        "education_entries",
        "licenses",
        "profiles",
        "sessions",
        "users",
        "verifications",
        "work_history_entries",
        "platforms",
        "recruiters",
        "companies",
        "applications",
        "application_stages",
        "interviews",
        "interview_feedbacks",
        "slot_proposals",
        "proposed_slots",
        "busy_blocks",
      ]),
    );
  });

  it("seeds preset platforms", async () => {
    const rows = await getDb().select().from(platforms);
    expect(rows.filter((row) => row.userId === null).map((row) => row.code)).toEqual(
      expect.arrayContaining(["doda", "en_tenshoku", "mynavi_tenshoku"]),
    );
  });

  it("rejects overlapping confirmed interviews for the same user", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const [platform] = await db.select().from(platforms).limit(1);
    const [company] = await db
      .insert(companies)
      .values({ userId: user.id, name: "重複株式会社" })
      .returning();
    const [app] = await db
      .insert(applications)
      .values({
        userId: user.id,
        companyId: company.id,
        platformId: platform.id,
        appliedOn: "2026-11-04",
      })
      .returning();
    const [stage] = await db
      .insert(applicationStages)
      .values({
        userId: user.id,
        applicationId: app.id,
        kind: "interview_1",
        position: 0,
        status: "pending",
      })
      .returning();
    await db.insert(interviews).values({
      userId: user.id,
      stageId: stage.id,
      startsAt: new Date("2026-11-12T05:00:00Z"),
      endsAt: new Date("2026-11-12T06:00:00Z"),
      mode: "google_meet",
    });
    await expect(
      db.insert(interviews).values({
        userId: user.id,
        stageId: stage.id,
        startsAt: new Date("2026-11-12T05:30:00Z"),
        endsAt: new Date("2026-11-12T06:30:00Z"),
        mode: "teams",
      }),
    ).rejects.toThrow();
  });

  it("enforces the ui_locale check constraint", async () => {
    await expect(
      getDb().insert(users).values(newUser({ uiLocale: "fr" })),
    ).rejects.toThrow();
    await getDb().insert(users).values(newUser({ uiLocale: "zh-CN" }));
  });

  it("keeps job_notes only and allows structured interview feedback", async () => {
    const db = getDb();
    const appCols = await db.execute<{ column_name: string }>(sql`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'applications'
      order by column_name`);
    const appNames = appCols.rows.map((row) => row.column_name);
    expect(appNames).toContain("job_notes");
    expect(appNames).not.toContain("notes");

    const fbCols = await db.execute<{ column_name: string }>(sql`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'interview_feedbacks'
      order by column_name`);
    const fbNames = fbCols.rows.map((row) => row.column_name);
    expect(fbNames).toEqual(
      expect.arrayContaining([
        "body",
        "question",
        "own_answer",
        "result_text",
        "reflection",
      ]),
    );
  });


  it("cascades user deletion to sessions and accounts", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    await db.insert(sessions).values({
      id: randomUUID(),
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 60_000),
      userId: user.id,
    });
    await db.insert(accounts).values({
      id: randomUUID(),
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
    });

    await db.delete(users).where(eq(users.id, user.id));

    expect(
      await db.select().from(sessions).where(eq(sessions.userId, user.id)),
    ).toHaveLength(0);
    expect(
      await db.select().from(accounts).where(eq(accounts.userId, user.id)),
    ).toHaveLength(0);
  });
});
