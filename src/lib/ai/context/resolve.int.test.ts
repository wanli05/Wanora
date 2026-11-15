import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import {
  containsDeniedProfileField,
  resolveAiContext,
} from "@/lib/ai/context";
import { createCareerProject } from "@/lib/data/career-projects";
import { createEducationEntry } from "@/lib/data/education-entries";
import { upsertProfile } from "@/lib/data/profiles";
import { yearMonthFromInput } from "@/lib/domain/dates";

function newUser(name = "Context Test") {
  return {
    id: randomUUID(),
    name,
    email: `${randomUUID()}@example.test`,
  };
}

describe("resolveAiContext integration", () => {
  it("filters sensitive profile fields and keeps whitelist content", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);

    await upsertProfile(db, user.id, {
      fullName: { ja: "山田太郎" },
      headline: "フルスタック",
      selfPr: { ja: "自己PR本文" },
      phone: "090-1234-5678",
      email: "secret@example.test",
      postalCode: "100-0001",
      address: { ja: "東京都千代田区" },
      residenceStatus: "技術・人文知識・国際業務",
      salaryAnnualMan: 500,
      dependentsCount: 2,
      hasSpouse: true,
    });

    const resolved = await resolveAiContext(db, {
      userId: user.id,
      pageContext: { path: "/career", area: "my_career" },
    });

    const profile = resolved.fragments.find((f) => f.section === "profile");
    expect(profile?.data).toMatchObject({
      fullName: { ja: "山田太郎" },
      headline: "フルスタック",
      selfPr: { ja: "自己PR本文" },
    });
    expect(containsDeniedProfileField(resolved.fragments)).toBeNull();
    expect(JSON.stringify(resolved)).not.toContain("090-1234-5678");
    expect(JSON.stringify(resolved)).not.toContain("secret@example.test");
    expect(JSON.stringify(resolved)).not.toContain("100-0001");
    expect(JSON.stringify(resolved)).not.toContain("技術・人文知識");
  });

  it("isolates users and rejects cross-user target ids", async () => {
    const db = getDb();
    const a = newUser("A");
    const b = newUser("B");
    await db.insert(users).values([a, b]);

    const projectA = await createCareerProject(db, a.id, {
      title: { ja: "AのPJ" },
      startYm: yearMonthFromInput(2024, 1),
      overview: { ja: "Aのみ" },
    });
    await upsertProfile(db, b.id, {
      fullName: { ja: "佐藤" },
      phone: "080-0000-0000",
    });

    const asB = await resolveAiContext(db, {
      userId: b.id,
      pageContext: { path: "/career", area: "my_career" },
      targetContext: { type: "career_project", id: projectA.id },
    });

    const target = asB.fragments.find((f) => f.section === "target");
    expect(target?.notes).toContain("target_not_found");
    expect(target?.data).toBeNull();
    expect(JSON.stringify(asB)).not.toContain("AのPJ");
    expect(JSON.stringify(asB)).not.toContain("Aのみ");
    expect(JSON.stringify(asB)).not.toContain("080-0000-0000");

    const profileB = asB.fragments.find((f) => f.section === "profile");
    expect(profileB?.data).toMatchObject({ fullName: { ja: "佐藤" } });
  });

  it("keeps target locked while page context differs", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    await upsertProfile(db, user.id, {
      fullName: { ja: "鈴木" },
      selfPr: { ja: "PR" },
      jobSummary: { ja: "要約" },
    });

    const resolved = await resolveAiContext(db, {
      userId: user.id,
      pageContext: { path: "/board", area: "board" },
      targetContext: { type: "profile", section: "self_pr" },
    });

    expect(resolved.targetLocked).toBe(true);
    expect(resolved.pageContext?.area).toBe("board");
    expect(resolved.targetContext).toEqual({
      type: "profile",
      section: "self_pr",
    });
    const target = resolved.fragments.find((f) => f.section === "target");
    expect(target?.data).toMatchObject({
      section: "self_pr",
      value: { ja: "PR" },
    });
  });

  it("truncates under AI_MAX_CONTEXT_CHARS while retaining source stubs", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);

    const long = "長文".repeat(800);
    await upsertProfile(db, user.id, {
      fullName: { ja: "高橋" },
      selfPr: { ja: long },
      jobSummary: { ja: long },
    });
    for (let i = 0; i < 6; i++) {
      await createCareerProject(db, user.id, {
        title: { ja: `PJ${i}` },
        startYm: yearMonthFromInput(2020 + i, 1),
        overview: { ja: long },
        responsibilities: { ja: long },
        results: { ja: long },
      });
    }

    const resolved = await resolveAiContext(
      db,
      {
        userId: user.id,
        pageContext: { path: "/career", area: "my_career" },
        targetContext: { type: "profile", section: "self_pr" },
        maxChars: 1500,
      },
      { maxChars: 1500 },
    );

    expect(resolved.truncated).toBe(true);
    expect(resolved.totalChars).toBeLessThanOrEqual(1500);
    expect(resolved.fragments.some((f) => f.section === "target")).toBe(true);
    expect(
      resolved.fragments.some(
        (f) =>
          f.truncated &&
          f.data &&
          typeof f.data === "object" &&
          "sourceId" in (f.data as object),
      ),
    ).toBe(true);
  });

  it("signals sparse career data when the user has no profile rows", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);

    const resolved = await resolveAiContext(db, {
      userId: user.id,
      pageContext: { path: "/career", area: "my_career" },
    });

    expect(resolved.warnings).toContain("career_data_sparse");
    expect(
      resolved.fragments.find((f) => f.section === "profile")?.notes,
    ).toContain("profile_empty");
  });

  it("does not load my_career on board page without a career target", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    await upsertProfile(db, user.id, {
      fullName: { ja: "Board User" },
      phone: "070-1111-2222",
    });

    const resolved = await resolveAiContext(db, {
      userId: user.id,
      pageContext: { path: "/board", area: "board" },
    });

    expect(resolved.fragments).toHaveLength(0);
    expect(JSON.stringify(resolved)).not.toContain("070-1111-2222");
  });

  it("includes education owned by the user when targeted", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);
    const edu = await createEducationEntry(db, user.id, {
      yearMonth: yearMonthFromInput(2015, 3),
      school: { ja: "テスト大学" },
      eventCode: "graduated",
    });

    const resolved = await resolveAiContext(db, {
      userId: user.id,
      targetContext: { type: "education", id: edu.id },
    });

    const target = resolved.fragments.find((f) => f.section === "target");
    expect(target?.data).toMatchObject({
      id: edu.id,
      school: { ja: "テスト大学" },
      eventCode: "graduated",
    });
  });
});
