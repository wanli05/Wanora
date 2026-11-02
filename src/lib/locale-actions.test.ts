// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyAccountLocale, changeLocale } from "./locale-actions";
import type { SessionUser } from "./session";

const jar = new Map<string, { value: string; options: unknown }>();
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: (name: string) => {
      const entry = jar.get(name);
      return entry && { name, value: entry.value };
    },
    set: (name: string, value: string, options: unknown) =>
      jar.set(name, { value, options }),
  }),
}));

let sessionUser: SessionUser | null = null;
vi.mock("./session", () => ({ getSessionUser: async () => sessionUser }));

const updateUiLocale = vi.fn();
vi.mock("./data/users", () => ({
  updateUiLocale: (...a: unknown[]) => updateUiLocale(...a),
}));
vi.mock("@/db", () => ({ getDb: () => "db" }));

const user: SessionUser = {
  id: "user-1",
  email: "a@example.test",
  name: "A",
  uiLocale: "zh-CN",
};

beforeEach(() => {
  jar.clear();
  sessionUser = null;
  vi.clearAllMocks();
});

describe("changeLocale", () => {
  it("sets a year-long locale cookie for guests without touching the DB", async () => {
    await changeLocale("en");
    expect(jar.get("NEXT_LOCALE")).toEqual({
      value: "en",
      options: { maxAge: 31536000, sameSite: "lax", path: "/" },
    });
    expect(updateUiLocale).not.toHaveBeenCalled();
  });

  it("saves the choice to the signed-in user's account", async () => {
    sessionUser = user;
    await changeLocale("ja");
    expect(jar.get("NEXT_LOCALE")?.value).toBe("ja");
    expect(updateUiLocale).toHaveBeenCalledWith("db", "user-1", "ja");
  });

  it("rejects unsupported locales", async () => {
    sessionUser = user;
    // @ts-expect-error -- server actions receive untrusted input
    await expect(changeLocale("fr")).rejects.toThrow();
    expect(jar.size).toBe(0);
    expect(updateUiLocale).not.toHaveBeenCalled();
  });
});

describe("applyAccountLocale", () => {
  it("does nothing for guests", async () => {
    expect(await applyAccountLocale()).toBe(false);
    expect(jar.size).toBe(0);
  });

  it("switches the cookie to the account's language", async () => {
    sessionUser = user;
    jar.set("NEXT_LOCALE", { value: "ja", options: {} });
    expect(await applyAccountLocale()).toBe(true);
    expect(jar.get("NEXT_LOCALE")?.value).toBe("zh-CN");
  });

  it("reports no change when the cookie already matches", async () => {
    sessionUser = user;
    jar.set("NEXT_LOCALE", { value: "zh-CN", options: {} });
    expect(await applyAccountLocale()).toBe(false);
  });
});
