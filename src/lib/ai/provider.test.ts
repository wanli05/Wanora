import { afterEach, describe, expect, it } from "vitest";
import { getAiProvider } from "@/lib/ai/provider";
import { resetServerEnvCache } from "@/lib/env";

afterEach(() => {
  delete process.env.AI_PROVIDER;
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
});
