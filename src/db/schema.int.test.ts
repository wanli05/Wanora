import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { accounts, sessions, users } from "./schema";

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
      ]),
    );
  });

  it("enforces the ui_locale check constraint", async () => {
    await expect(
      getDb().insert(users).values(newUser({ uiLocale: "fr" })),
    ).rejects.toThrow();
    await getDb().insert(users).values(newUser({ uiLocale: "zh-CN" }));
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
