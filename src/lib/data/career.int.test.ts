import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { yearMonthFromInput } from "@/lib/domain/dates";
import {
  createCareerEmployer,
  listCareerEmployers,
} from "@/lib/data/career-employers";
import {
  createCareerGoal,
  listCareerGoals,
} from "@/lib/data/career-goals";
import {
  createCareerProject,
  listCareerProjects,
  listConfirmedCareerProjects,
} from "@/lib/data/career-projects";
import {
  createCareerSkill,
  listCareerSkills,
} from "@/lib/data/career-skills";
import { getProfileByUserId, upsertProfile } from "@/lib/data/profiles";

function newUser() {
  return {
    id: randomUUID(),
    name: "Career Test",
    email: `${randomUUID()}@example.test`,
  };
}

describe("my career data access", () => {
  it("stores career profile extras and portfolio rows per user", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);

    await upsertProfile(db, user.id, {
      fullName: { ja: "山田" },
      headline: "PL",
      directionTags: ["要件定義"],
      languages: [{ language: "日本語", level: "ビジネス" }],
      residenceStatus: "技術・人文知識・国際業務",
      salaryAnnualMan: 440,
      salaryHope: "460〜500万円",
      strengths: ["ベンダーコントロール"],
      selfPr: { ja: "PR" },
      jobSummary: { ja: "要約" },
    });

    const profile = await getProfileByUserId(db, user.id);
    expect(profile).toMatchObject({
      headline: "PL",
      salaryAnnualMan: 440,
      residenceStatus: "技術・人文知識・国際業務",
    });
    expect(profile?.languages).toEqual([
      { language: "日本語", level: "ビジネス" },
    ]);

    await createCareerEmployer(db, user.id, {
      companyName: { ja: "株式会社テスト" },
      title: "PL",
      startYm: yearMonthFromInput(2024, 4),
      capitalText: "100百万円",
    });
    expect(await listCareerEmployers(db, user.id)).toHaveLength(1);

    await createCareerProject(db, user.id, {
      title: { ja: "確定PJ" },
      titleUrl: "https://example.com",
      startYm: yearMonthFromInput(2025, 9),
      status: "confirmed",
      overview: { ja: "概要" },
    });
    await createCareerProject(db, user.id, {
      title: { ja: "草稿PJ" },
      startYm: yearMonthFromInput(2025, 1),
      status: "pending_confirm",
    });
    expect(await listCareerProjects(db, user.id)).toHaveLength(2);
    expect(await listConfirmedCareerProjects(db, user.id)).toHaveLength(1);

    await createCareerSkill(db, user.id, {
      category: "言語",
      name: "TypeScript",
      yearsText: "4年",
      description: "Web",
    });
    expect(await listCareerSkills(db, user.id)).toHaveLength(1);

    await createCareerGoal(db, user.id, {
      kind: "short",
      content: { ja: "上流を広げる" },
    });
    expect(await listCareerGoals(db, user.id)).toHaveLength(1);
  });

  it("preserves career extras when upserting identity-only fields", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);

    await upsertProfile(db, user.id, {
      fullName: { ja: "山田" },
      headline: "keep-me",
      languages: [{ language: "英語", level: "ビジネス" }],
    });
    await upsertProfile(db, user.id, {
      fullName: { ja: "山田太郎" },
      phone: "090",
    });

    const profile = await getProfileByUserId(db, user.id);
    expect(profile?.fullName).toEqual({ ja: "山田太郎" });
    expect(profile?.headline).toBe("keep-me");
    expect(profile?.languages).toEqual([
      { language: "英語", level: "ビジネス" },
    ]);
  });
});
