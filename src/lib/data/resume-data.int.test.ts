import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { educationEntries, profiles, users } from "@/db/schema";
import {
  createEducationEntry,
  getEducationEntry,
  listEducationEntries,
} from "@/lib/data/education-entries";
import { createLicense, listLicenses } from "@/lib/data/licenses";
import { getProfileByUserId, upsertProfile } from "@/lib/data/profiles";
import { createWorkHistoryEntry, listWorkHistoryEntries } from "@/lib/data/work-history-entries";
import { yearMonthFromInput } from "@/lib/domain/dates";

function newUser() {
  return {
    id: randomUUID(),
    name: "Resume Test",
    email: `${randomUUID()}@example.test`,
  };
}

describe("resume data access", () => {
  it("stores profile per user and enforces isolation", async () => {
    const db = getDb();
    const userA = newUser();
    const userB = newUser();
    await db.insert(users).values([userA, userB]);

    await upsertProfile(db, userA.id, {
      fullName: { ja: "山田" },
      phone: "090",
    });
    await upsertProfile(db, userB.id, {
      fullName: { en: "Smith" },
    });

    expect(await getProfileByUserId(db, userA.id)).toMatchObject({
      fullName: { ja: "山田" },
    });
    expect(await getProfileByUserId(db, userB.id)).toMatchObject({
      fullName: { en: "Smith" },
    });
    expect(
      await db.select().from(profiles).where(eq(profiles.userId, userA.id)),
    ).toHaveLength(1);
  });

  it("CRUDs education, work history, and licenses with year_month day=1", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const ym = yearMonthFromInput(2020, 4);

    const education = await createEducationEntry(db, user.id, {
      yearMonth: ym,
      school: { ja: "〇〇大学" },
      eventCode: "enrolled",
    });
    expect(education.yearMonth.getUTCDate()).toBe(1);
    expect(await listEducationEntries(db, user.id)).toHaveLength(1);
    expect(await getEducationEntry(db, user.id, education.id)).toBeDefined();
    await expect(
      getEducationEntry(db, newUser().id, education.id),
    ).resolves.toBeUndefined();

    await createWorkHistoryEntry(db, user.id, {
      yearMonth: ym,
      company: { ja: "株式会社テスト" },
      eventCode: "joined",
    });

    await createLicense(db, user.id, {
      name: { ja: "普通自動車免許" },
      acquiredYm: yearMonthFromInput(2018, 3),
    });
    expect(await listLicenses(db, user.id)).toHaveLength(1);

    await db.delete(educationEntries).where(eq(educationEntries.userId, user.id));
    expect(await listEducationEntries(db, user.id)).toHaveLength(0);
  });

  it("lists timeline rows in chronological order regardless of sort_order", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);

    await createEducationEntry(db, user.id, {
      yearMonth: yearMonthFromInput(2022, 4),
      school: { ja: "後" },
      eventCode: "enrolled",
      sortOrder: 0,
    });
    await createEducationEntry(db, user.id, {
      yearMonth: yearMonthFromInput(2018, 4),
      school: { ja: "先" },
      eventCode: "graduated",
      sortOrder: 1,
    });

    const education = await listEducationEntries(db, user.id);
    expect(education.map((row) => row.school)).toEqual([
      { ja: "先" },
      { ja: "後" },
    ]);

    await createWorkHistoryEntry(db, user.id, {
      yearMonth: yearMonthFromInput(2024, 1),
      company: { ja: "新" },
      eventCode: "joined",
      sortOrder: 0,
    });
    await createWorkHistoryEntry(db, user.id, {
      yearMonth: yearMonthFromInput(2020, 6),
      company: { ja: "旧" },
      eventCode: "left",
      sortOrder: 1,
    });
    expect(
      (await listWorkHistoryEntries(db, user.id)).map((row) => row.company),
    ).toEqual([{ ja: "旧" }, { ja: "新" }]);

    await createLicense(db, user.id, {
      name: { ja: "新" },
      acquiredYm: yearMonthFromInput(2023, 12),
      sortOrder: 0,
    });
    await createLicense(db, user.id, {
      name: { ja: "旧" },
      acquiredYm: yearMonthFromInput(2019, 3),
      sortOrder: 1,
    });
    expect((await listLicenses(db, user.id)).map((row) => row.name)).toEqual([
      { ja: "旧" },
      { ja: "新" },
    ]);
  });
});
