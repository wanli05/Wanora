import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env";

const base = {
  DATABASE_URL: "postgres://u:p@localhost:5432/wanora",
  AUTH_SECRET: "x".repeat(32),
};

describe("parseServerEnv", () => {
  it("accepts the minimal config and defaults AUTH_URL", () => {
    expect(parseServerEnv(base)).toMatchObject({
      ...base,
      AUTH_URL: "http://localhost:3000",
    });
  });

  it("rejects a missing DATABASE_URL or short AUTH_SECRET", () => {
    expect(() => parseServerEnv({ AUTH_SECRET: base.AUTH_SECRET })).toThrow();
    expect(() => parseServerEnv({ ...base, AUTH_SECRET: "short" })).toThrow();
  });

  it("treats empty strings as unset", () => {
    expect(
      parseServerEnv({
        ...base,
        AUTH_URL: "",
        AUTH_GOOGLE_CLIENT_ID: "",
        AUTH_GOOGLE_CLIENT_SECRET: "",
      }),
    ).not.toHaveProperty("AUTH_GOOGLE_CLIENT_ID");
  });

  it("requires Google credentials to be set together", () => {
    expect(() =>
      parseServerEnv({ ...base, AUTH_GOOGLE_CLIENT_ID: "id" }),
    ).toThrow(/set together/);
    expect(
      parseServerEnv({
        ...base,
        AUTH_GOOGLE_CLIENT_ID: "id",
        AUTH_GOOGLE_CLIENT_SECRET: "secret",
      }).AUTH_GOOGLE_CLIENT_ID,
    ).toBe("id");
  });

  it("requires S3 settings to be set together", () => {
    expect(() =>
      parseServerEnv({
        ...base,
        S3_ENDPOINT: "http://localhost:9000",
        S3_ACCESS_KEY: "minioadmin",
      }),
    ).toThrow(/S3_/);
  });

  it("defaults AI flags safely when unset", () => {
    const env = parseServerEnv(base);
    expect(env.AI_ENABLED).toBe(false);
    expect(env.AI_PROVIDER).toBe("mock");
    expect(env.AI_RATE_LIMIT_PER_MINUTE).toBe(10);
    expect(env.AI_DAILY_TOKEN_BUDGET).toBe(100_000);
    expect(env.AI_DAILY_COST_BUDGET_USD).toBe(1);
    expect(env.AI_GLOBAL_DAILY_COST_BUDGET_USD).toBe(20);
    expect(env.AI_MAX_CONTEXT_CHARS).toBe(12_000);
    expect(env.AI_CHAT_HARD_DELETE_AFTER_DAYS).toBe(30);
    expect(env.AI_PURGE_SECRET).toBeUndefined();
  });

  it("parses AI_ENABLED true/false strings", () => {
    expect(parseServerEnv({ ...base, AI_ENABLED: "true" }).AI_ENABLED).toBe(
      true,
    );
    expect(parseServerEnv({ ...base, AI_ENABLED: "false" }).AI_ENABLED).toBe(
      false,
    );
  });

  it("parses AI budget and rate limit numbers", () => {
    const env = parseServerEnv({
      ...base,
      AI_RATE_LIMIT_PER_MINUTE: "5",
      AI_DAILY_TOKEN_BUDGET: "50000",
      AI_DAILY_COST_BUDGET_USD: "0.5",
      AI_GLOBAL_DAILY_COST_BUDGET_USD: "10",
      AI_MAX_CONTEXT_CHARS: "8000",
      AI_CHAT_HARD_DELETE_AFTER_DAYS: "14",
      AI_PURGE_SECRET: "purge-test-secret",
    });
    expect(env.AI_RATE_LIMIT_PER_MINUTE).toBe(5);
    expect(env.AI_DAILY_TOKEN_BUDGET).toBe(50_000);
    expect(env.AI_DAILY_COST_BUDGET_USD).toBe(0.5);
    expect(env.AI_GLOBAL_DAILY_COST_BUDGET_USD).toBe(10);
    expect(env.AI_MAX_CONTEXT_CHARS).toBe(8000);
    expect(env.AI_CHAT_HARD_DELETE_AFTER_DAYS).toBe(14);
    expect(env.AI_PURGE_SECRET).toBe("purge-test-secret");
  });

  it("rejects unknown AI_PROVIDER values in Phase 1A", () => {
    expect(() =>
      parseServerEnv({ ...base, AI_PROVIDER: "openai_compatible" }),
    ).toThrow();
  });
});
