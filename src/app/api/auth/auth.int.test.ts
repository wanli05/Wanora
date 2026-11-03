import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { accounts, users } from "@/db/schema";
import {
  callAuth,
  cookieFrom,
  signUp,
  uniqueEmail,
} from "../../../../test/integration/http";

const PASSWORD = "correct-horse-battery";

describe("email + password auth", () => {
  it("signs up, creates a session and defaults ui_locale to ja", async () => {
    const email = uniqueEmail("signup");
    const { res, cookie } = await signUp(email, PASSWORD, "山田 太郎");
    expect(res.status).toBe(200);
    expect(cookie).toContain("better-auth.session_token=");

    const session = await callAuth("/get-session", { cookie });
    const body = await session.json();
    expect(body.user).toMatchObject({
      email,
      name: "山田 太郎",
      uiLocale: "ja",
    });
  });

  it("stores only a password hash", async () => {
    const email = uniqueEmail("hash");
    await signUp(email, PASSWORD);
    const [row] = await getDb()
      .select({ password: accounts.password, providerId: accounts.providerId })
      .from(accounts)
      .innerJoin(users, eq(users.id, accounts.userId))
      .where(eq(users.email, email));
    expect(row.providerId).toBe("credential");
    expect(row.password).toBeTruthy();
    expect(row.password).not.toContain(PASSWORD);
  });

  it("accepts a valid ui_locale at sign-up and rejects an unknown one", async () => {
    const ok = await callAuth("/sign-up/email", {
      body: {
        email: uniqueEmail("zh"),
        password: PASSWORD,
        name: "张三",
        uiLocale: "zh-CN",
      },
    });
    expect(ok.status).toBe(200);
    expect((await ok.json()).user.uiLocale).toBe("zh-CN");

    const bad = await callAuth("/sign-up/email", {
      body: {
        email: uniqueEmail("fr"),
        password: PASSWORD,
        name: "Jean",
        uiLocale: "fr",
      },
    });
    expect(bad.status).toBe(400);
  });

  it("rejects duplicate emails and short passwords", async () => {
    const email = uniqueEmail("dup");
    await signUp(email, PASSWORD);
    const dup = await signUp(email, PASSWORD);
    expect(dup.res.ok).toBe(false);

    const short = await signUp(uniqueEmail("short"), "1234567");
    expect(short.res.status).toBe(400);
  });

  it("signs in with the right password only", async () => {
    const email = uniqueEmail("signin");
    await signUp(email, PASSWORD);

    const wrong = await callAuth("/sign-in/email", {
      body: { email, password: "wrong-password" },
    });
    expect(wrong.status).toBe(401);
    expect(cookieFrom(wrong)).not.toContain("session_token=");

    const right = await callAuth("/sign-in/email", {
      body: { email, password: PASSWORD },
    });
    expect(right.status).toBe(200);
    const session = await callAuth("/get-session", {
      cookie: cookieFrom(right),
    });
    expect((await session.json()).user.email).toBe(email);
  });

  it("invalidates the session on sign-out", async () => {
    const { cookie } = await signUp(uniqueEmail("signout"), PASSWORD);

    const out = await callAuth("/sign-out", { method: "POST", cookie });
    expect(out.status).toBe(200);

    const session = await callAuth("/get-session", { cookie });
    expect(await session.json()).toBeNull();
  });

  it("returns no session for a missing or forged cookie", async () => {
    expect(await (await callAuth("/get-session")).json()).toBeNull();
    const forged = await callAuth("/get-session", {
      cookie: "better-auth.session_token=forged.value",
    });
    expect(await forged.json()).toBeNull();
  });

  it("allows sign-up from 127.0.0.1 when AUTH_URL uses localhost", async () => {
    const email = uniqueEmail("loopback");
    const res = await callAuth("/sign-up/email", {
      origin: "http://127.0.0.1:3000",
      body: { email, password: PASSWORD, name: "Loopback" },
    });
    expect(res.status).toBe(200);
  });
});
