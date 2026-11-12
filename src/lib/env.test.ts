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
});
