import { afterEach, describe, expect, it } from "vitest";
import { getAiProvider } from "@/lib/ai/provider";
import { resetServerEnvCache } from "@/lib/env";

afterEach(() => {
  delete process.env.AI_PROVIDER;
  delete process.env.OPENAI_API_KEY;
  delete process.env.AI_DEFAULT_MODEL;
  resetServerEnvCache();
});

describe("getAiProvider", () => {
  it("resolves the mock provider from AI_PROVIDER", () => {
    process.env.DATABASE_URL ??= "postgres://u:p@localhost:5432/wanora";
    process.env.AUTH_SECRET ??= "x".repeat(32);
    process.env.AI_PROVIDER = "mock";
    resetServerEnvCache();

    const provider = getAiProvider();
    expect(provider.id).toBe("mock");
  });

  it("resolves the openai provider when configured with a key", () => {
    process.env.DATABASE_URL ??= "postgres://u:p@localhost:5432/wanora";
    process.env.AUTH_SECRET ??= "x".repeat(32);
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test-not-real";
    process.env.AI_DEFAULT_MODEL = "gpt-5-mini";
    resetServerEnvCache();

    const provider = getAiProvider();
    expect(provider.id).toBe("openai");
  });
});
