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
import { createWorkHistoryEntry } from "@/lib/data/work-history-entries";
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
      status: "acquired",
    });
    expect(await listLicenses(db, user.id)).toHaveLength(1);

    await db.delete(educationEntries).where(eq(educationEntries.userId, user.id));
    expect(await listEducationEntries(db, user.id)).toHaveLength(0);
  });
});
