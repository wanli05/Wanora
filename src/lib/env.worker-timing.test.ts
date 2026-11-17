import { afterEach, describe, expect, it } from "vitest";
import { parseServerEnv, resetServerEnvCache } from "@/lib/env";

const base = {
  DATABASE_URL: "postgres://u:p@localhost:5432/wanora",
  AUTH_SECRET: "x".repeat(32),
};

afterEach(() => {
  resetServerEnvCache();
});

describe("server env worker lease refine", () => {
  it("accepts default lease vs timeout + slack", () => {
    const env = parseServerEnv({ ...base });
    expect(env.AI_WORKER_LEASE_MS).toBe(90_000);
    expect(env.AI_OPENAI_TIMEOUT_MS).toBe(60_000);
    expect(env.AI_WORKER_SETTLE_SLACK_MS).toBe(15_000);
  });

  it("rejects lease that cannot cover provider timeout + slack", () => {
    expect(() =>
      parseServerEnv({
        ...base,
        AI_WORKER_LEASE_MS: "70000",
        AI_OPENAI_TIMEOUT_MS: "60000",
        AI_WORKER_SETTLE_SLACK_MS: "15000",
      }),
    ).toThrow(/AI_WORKER_LEASE_MS/);
  });
});
