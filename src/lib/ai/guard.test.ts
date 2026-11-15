import { afterEach, describe, expect, it, vi } from "vitest";
import { guardedComplete } from "@/lib/ai/guard";
import { resetServerEnvCache } from "@/lib/env";
import type { Db } from "@/db";

afterEach(() => {
  delete process.env.AI_ENABLED;
  resetServerEnvCache();
  vi.restoreAllMocks();
});

function stubEnv(overrides: Record<string, string> = {}) {
  process.env.DATABASE_URL ??= "postgres://u:p@localhost:5432/wanora";
  process.env.AUTH_SECRET ??= "x".repeat(32);
  Object.assign(process.env, overrides);
  resetServerEnvCache();
}

describe("guardedComplete prechecks", () => {
  it("rejects when AI is disabled without touching the database", async () => {
    stubEnv({ AI_ENABLED: "false" });
    const db = { transaction: vi.fn() } as unknown as Db;

    const outcome = await guardedComplete(db, {
      userId: "user-1",
      requestId: "req-1",
      feature: "chat",
      messages: [{ role: "user", content: "hello" }],
    });

    expect(outcome).toEqual({
      ok: false,
      code: "ai_unavailable",
      message: "AI is disabled",
    });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("rejects empty requestId and empty messages", async () => {
    stubEnv({ AI_ENABLED: "true" });
    const db = { transaction: vi.fn() } as unknown as Db;

    expect(
      await guardedComplete(db, {
        userId: "u",
        requestId: "  ",
        feature: "chat",
        messages: [{ role: "user", content: "x" }],
      }),
    ).toMatchObject({ ok: false, code: "invalid_request" });

    expect(
      await guardedComplete(db, {
        userId: "u",
        requestId: "r1",
        feature: "chat",
        messages: [],
      }),
    ).toMatchObject({ ok: false, code: "invalid_request" });

    expect(db.transaction).not.toHaveBeenCalled();
  });
});
