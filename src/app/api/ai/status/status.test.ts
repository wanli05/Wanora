import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetServerEnvCache } from "@/lib/env";

vi.mock("next/server", () => ({
  connection: vi.fn(async () => undefined),
}));

describe("GET /api/ai/status", () => {
  beforeEach(() => {
    process.env.DATABASE_URL ??= "postgres://u:p@localhost:5432/wanora";
    process.env.AUTH_SECRET ??= "x".repeat(32);
    resetServerEnvCache();
  });

  afterEach(() => {
    delete process.env.AI_ENABLED;
    resetServerEnvCache();
  });

  it("reports disabled by default", async () => {
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(false);
    expect(body.provider).toBe("mock");
  });

  it("reports enabled when AI_ENABLED=true", async () => {
    process.env.AI_ENABLED = "true";
    resetServerEnvCache();
    const { GET } = await import("./route");
    const body = await (await GET()).json();
    expect(body.enabled).toBe(true);
  });
});
