import { afterEach, describe, expect, it } from "vitest";
import { resetServerEnvCache } from "@/lib/env";
import { GET } from "./route";

describe("GET /api/ai/status", () => {
  afterEach(() => {
    delete process.env.AI_ENABLED;
    resetServerEnvCache();
  });

  it("reports disabled by default", async () => {
    process.env.DATABASE_URL ??= "postgres://u:p@localhost:5432/wanora";
    process.env.AUTH_SECRET ??= "x".repeat(32);
    resetServerEnvCache();
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(false);
    expect(body.provider).toBe("mock");
  });

  it("reports enabled when AI_ENABLED=true", async () => {
    process.env.DATABASE_URL ??= "postgres://u:p@localhost:5432/wanora";
    process.env.AUTH_SECRET ??= "x".repeat(32);
    process.env.AI_ENABLED = "true";
    resetServerEnvCache();
    const body = await (await GET()).json();
    expect(body.enabled).toBe(true);
  });
});
