import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import {
  BASE_URL,
  signUp,
  uniqueEmail,
} from "../../../../test/integration/http";
import { GET, PATCH } from "./route";

function meRequest(method: "GET" | "PATCH", cookie?: string, body?: unknown) {
  const headers = new Headers({ "content-type": "application/json" });
  if (cookie) headers.set("cookie", cookie);
  return new Request(`${BASE_URL}/api/me`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function localeOf(email: string) {
  const [row] = await getDb()
    .select({ uiLocale: users.uiLocale })
    .from(users)
    .where(eq(users.email, email));
  return row.uiLocale;
}

describe("/api/me", () => {
  it("requires a session", async () => {
    expect((await GET(meRequest("GET"))).status).toBe(401);
    expect(
      (await PATCH(meRequest("PATCH", undefined, { uiLocale: "en" }))).status,
    ).toBe(401);
  });

  it("returns only the session user's data", async () => {
    const emailA = uniqueEmail("a");
    const emailB = uniqueEmail("b");
    const a = await signUp(emailA, undefined, "User A");
    const b = await signUp(emailB, undefined, "User B");

    const meA = await (await GET(meRequest("GET", a.cookie))).json();
    const meB = await (await GET(meRequest("GET", b.cookie))).json();
    expect(meA).toMatchObject({ email: emailA, name: "User A" });
    expect(meB).toMatchObject({ email: emailB, name: "User B" });
    expect(meA.id).not.toBe(meB.id);
  });

  it("updates only the session user, ignoring ids in the body", async () => {
    const emailA = uniqueEmail("a");
    const emailB = uniqueEmail("b");
    const a = await signUp(emailA);
    const b = await signUp(emailB);
    const meB = await (await GET(meRequest("GET", b.cookie))).json();

    const forged = await PATCH(
      meRequest("PATCH", a.cookie, { uiLocale: "en", id: meB.id }),
    );
    expect(forged.status).toBe(400);

    const res = await PATCH(meRequest("PATCH", a.cookie, { uiLocale: "en" }));
    expect(res.status).toBe(200);
    expect(await localeOf(emailA)).toBe("en");
    expect(await localeOf(emailB)).toBe("ja");

    const meA = await (await GET(meRequest("GET", a.cookie))).json();
    expect(meA.uiLocale).toBe("en");
  });

  it("rejects unsupported locales", async () => {
    const { cookie } = await signUp(uniqueEmail("bad-locale"));
    const res = await PATCH(meRequest("PATCH", cookie, { uiLocale: "fr" }));
    expect(res.status).toBe(400);
  });
});
