import { describe, expect, it } from "vitest";
import {
  assertAiIsolatedDatabaseUrl,
  checkAiIsolatedDatabaseUrl,
  resolveAiTestDatabaseUrl,
} from "@/lib/ai/testing/database-url";

describe("checkAiIsolatedDatabaseUrl", () => {
  it("rejects the shared local development database wanora", () => {
    const check = checkAiIsolatedDatabaseUrl(
      "postgres://wanora:wanora@localhost:5432/wanora",
    );
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.reason).toMatch(/forbidden/i);
      expect(check.database).toBe("wanora");
    }
  });

  it("rejects localhost alone when db name has no test marker", () => {
    const check = checkAiIsolatedDatabaseUrl(
      "postgres://app:secret@127.0.0.1:5432/myapp",
    );
    expect(check.ok).toBe(false);
  });

  it("rejects cloud hosts even with a test db name", () => {
    const check = checkAiIsolatedDatabaseUrl(
      "postgres://u:p@ep-foo.neon.tech:5432/wanora_ai_test",
    );
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toMatch(/cloud|managed/i);
  });

  it("accepts Testcontainers-style loopback/test", () => {
    const check = checkAiIsolatedDatabaseUrl(
      "postgres://test:test@localhost:54321/test",
    );
    expect(check).toEqual({
      ok: true,
      host: "localhost",
      database: "test",
      reason: "testcontainers-style loopback/test",
    });
  });

  it("rejects database name test with a non-testcontainers user", () => {
    const check = checkAiIsolatedDatabaseUrl(
      "postgres://wanora:x@localhost:5432/test",
    );
    expect(check.ok).toBe(false);
  });

  it("accepts explicit wanora_ai_test on loopback", () => {
    const check = checkAiIsolatedDatabaseUrl(
      "postgres://wanora:x@127.0.0.1:5432/wanora_ai_test",
    );
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.database).toBe("wanora_ai_test");
  });

  it("assert throws on shared wanora", () => {
    expect(() =>
      assertAiIsolatedDatabaseUrl(
        "postgres://wanora:wanora@localhost:5432/wanora",
      ),
    ).toThrow(/isolation check failed/i);
  });
});

describe("resolveAiTestDatabaseUrl", () => {
  it("prefers WANORA_AI_TEST_DATABASE_URL when isolated", () => {
    const url = resolveAiTestDatabaseUrl({
      WANORA_AI_TEST_DATABASE_URL:
        "postgres://test:test@localhost:5555/wanora_ai_test",
      DATABASE_URL: "postgres://wanora:wanora@localhost:5432/wanora",
    });
    expect(url).toContain("wanora_ai_test");
  });

  it("uses DATABASE_URL only when WANORA_AI_TEST_DB=1 and isolated", () => {
    const url = resolveAiTestDatabaseUrl({
      WANORA_AI_TEST_DB: "1",
      DATABASE_URL: "postgres://test:test@localhost:54321/test",
    });
    expect(url).toContain("/test");
  });

  it("refuses bare DATABASE_URL pointing at shared wanora", () => {
    expect(() =>
      resolveAiTestDatabaseUrl({
        DATABASE_URL: "postgres://wanora:wanora@localhost:5432/wanora",
      }),
    ).toThrow(/isolated AI test database/i);
  });
});
