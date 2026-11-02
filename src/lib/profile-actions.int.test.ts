import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getProfileByUserId } from "@/lib/data/profiles";
import { saveProfileAction } from "@/lib/profile-actions";
import { signUp, uniqueEmail } from "../../test/integration/http";

let sessionCookie = "";

vi.mock("next/headers", () => ({
  headers: () =>
    Promise.resolve(
      new Headers(sessionCookie ? { cookie: sessionCookie } : {}),
    ),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("saveProfileAction", () => {
  it("returns ok and stores Japanese full name", async () => {
    const email = uniqueEmail("profile-save");
    const { cookie } = await signUp(email, "correct-horse-battery", "テスト");
    sessionCookie = cookie;

    const [user] = await getDb()
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));

    const fd = new FormData();
    fd.set("fullName_ja", "山田太郎");
    fd.set("phone", "09011112222");

    const result = await saveProfileAction({}, fd);
    expect(result).toEqual({ ok: true });

    const profile = await getProfileByUserId(getDb(), user.id);
    expect(profile?.fullName).toEqual({ ja: "山田太郎" });
    expect(profile?.phone).toBe("09011112222");
  });

  it("returns fullNameRequired when name is missing on first save", async () => {
    const email = uniqueEmail("profile-noname");
    const { cookie } = await signUp(email, "correct-horse-battery", "テスト");
    sessionCookie = cookie;

    const fd = new FormData();
    fd.set("phone", "09000000000");

    const result = await saveProfileAction({}, fd);
    expect(result).toEqual({ error: "fullNameRequired" });
  });
});
