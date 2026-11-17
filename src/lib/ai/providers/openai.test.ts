import { describe, expect, it, vi } from "vitest";
import type { Response as OpenAIResponse } from "openai/resources/responses/responses";
import {
  ProviderCleanFailure,
  ProviderUncertainFailure,
} from "@/lib/ai/provider-errors";
import {
  createOpenAiProvider,
  type OpenAiResponsesClient,
} from "@/lib/ai/providers/openai";
import type { ServerEnv } from "@/lib/env";
import { AI_B1_DEFAULT_MODEL } from "@/lib/env";
import { PRICING_CATALOG_VERSION } from "@/lib/ai/pricing/catalog";

function baseEnv(overrides: Partial<ServerEnv> = {}): ServerEnv {
  return {
    DATABASE_URL: "postgres://u:p@localhost:5432/wanora",
    AUTH_SECRET: "x".repeat(32),
    AUTH_URL: "http://localhost:3000",
    AI_ENABLED: false,
    AI_PROVIDER: "openai",
    OPENAI_API_KEY: "test-key",
    AI_DEFAULT_MODEL: AI_B1_DEFAULT_MODEL,
    AI_OPENAI_TIMEOUT_MS: 5_000,
    AI_OPENAI_MAX_OUTPUT_TOKENS: 256,
    AI_MAX_HISTORY_MESSAGES: 40,
    AI_MAX_INPUT_CHARS: 100_000,
    AI_PRICING_VERSION: PRICING_CATALOG_VERSION,
    AI_LIVE_SMOKE: false,
    AI_RATE_LIMIT_PER_MINUTE: 10,
    AI_DAILY_TOKEN_BUDGET: 100_000,
    AI_DAILY_COST_BUDGET_USD: 1,
    AI_GLOBAL_DAILY_COST_BUDGET_USD: 20,
    AI_MAX_CONTEXT_CHARS: 12_000,
    AI_CHAT_HARD_DELETE_AFTER_DAYS: 30,
    AI_UNCERTAIN_RECONCILE_AFTER_HOURS: 24,
    ...overrides,
  } as ServerEnv;
}

function stubResponse(
  partial: Partial<OpenAIResponse> & { output_text?: string },
): OpenAIResponse {
  return {
    id: "resp_test",
    object: "response",
    created_at: 1,
    status: "completed",
    model: AI_B1_DEFAULT_MODEL,
    output: [],
    output_text: partial.output_text ?? "",
    usage: partial.usage ?? {
      input_tokens: 10,
      output_tokens: 5,
      total_tokens: 15,
      input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
      output_tokens_details: { reasoning_tokens: 0 },
    },
    ...partial,
  } as OpenAIResponse;
}

describe("createOpenAiProvider", () => {
  it("maps a successful Responses call without network", async () => {
    const create = vi.fn<OpenAiResponsesClient["responses"]["create"]>(
      async () =>
        stubResponse({
          output_text: "職務要約の改善案です。",
          usage: {
            input_tokens: 120,
            output_tokens: 30,
            total_tokens: 150,
            input_tokens_details: { cached_tokens: 40, cache_write_tokens: 0 },
            output_tokens_details: { reasoning_tokens: 8 },
          },
        }),
    );
    const client: OpenAiResponsesClient = { responses: { create } };
    const provider = createOpenAiProvider({
      env: baseEnv(),
      client,
      instructions: "あなたはWanoraのアシスタントです。",
    });

    const result = await provider.complete({
      feature: "chat",
      messages: [
        { role: "system", content: "【参照コンテキスト】\n{}" },
        { role: "user", content: "改善して" },
      ],
      requestKey: "job-1",
    });

    expect(provider.id).toBe("openai");
    expect(result.text).toContain("職務要約");
    expect(result.provider).toBe("openai");
    expect(result.model).toBe(AI_B1_DEFAULT_MODEL);
    expect(result.usage.inputTokens).toBe(120);
    expect(result.usage.outputTokens).toBe(30);
    expect(result.usage.cachedInputTokens).toBe(40);
    expect(result.usage.reasoningTokens).toBe(8);
    expect(result.providerResponseId).toBe("resp_test");
    expect(result.rawUsage).toMatchObject({ cached_tokens: 40 });

    expect(create).toHaveBeenCalledOnce();
    const [body, opts] = create.mock.calls[0]!;
    expect(body).toMatchObject({
      model: AI_B1_DEFAULT_MODEL,
      instructions: "あなたはWanoraのアシスタントです。",
      max_output_tokens: 256,
      store: false,
    });
    expect(body.input).toEqual([
      { role: "system", content: "【参照コンテキスト】\n{}" },
      { role: "user", content: "改善して" },
    ]);
    expect(opts?.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns empty text with usage for billed settle (not uncertain)", async () => {
    const client: OpenAiResponsesClient = {
      responses: {
        create: async () =>
          stubResponse({
            output_text: "   ",
            usage: {
              input_tokens: 50,
              output_tokens: 1,
              total_tokens: 51,
              input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
              output_tokens_details: { reasoning_tokens: 0 },
            },
          }),
      },
    };
    const provider = createOpenAiProvider({ env: baseEnv(), client });
    const result = await provider.complete({
      feature: "chat",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(result.text).toBe("");
    expect(result.usage.inputTokens).toBe(50);
    expect(result.usage.outputTokens).toBe(1);
  });

  it("throws clean invalid_output when empty with zero usage", async () => {
    const client: OpenAiResponsesClient = {
      responses: {
        create: async () =>
          stubResponse({
            output_text: "",
            usage: {
              input_tokens: 0,
              output_tokens: 0,
              total_tokens: 0,
              input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
              output_tokens_details: { reasoning_tokens: 0 },
            },
          }),
      },
    };
    const provider = createOpenAiProvider({ env: baseEnv(), client });
    await expect(
      provider.complete({
        feature: "chat",
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toBeInstanceOf(ProviderCleanFailure);
  });

  it("rejects models outside the allowlist", async () => {
    const create = vi.fn();
    const provider = createOpenAiProvider({
      env: baseEnv({ AI_ALLOWED_MODELS: "gpt-5-mini" }),
      client: { responses: { create } },
    });
    await expect(
      provider.complete({
        feature: "chat",
        model: "gpt-forbidden",
        messages: [{ role: "user", content: "x" }],
      }),
    ).rejects.toBeInstanceOf(ProviderCleanFailure);
    expect(create).not.toHaveBeenCalled();
  });

  it("forwards abort via signal option", async () => {
    const create = vi.fn(async (_body, opts) => {
      expect(opts?.signal?.aborted).toBe(true);
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    });
    const provider = createOpenAiProvider({
      env: baseEnv(),
      client: { responses: { create } },
    });
    const ac = new AbortController();
    ac.abort();
    await expect(
      provider.complete({
        feature: "chat",
        messages: [{ role: "user", content: "x" }],
        signal: ac.signal,
      }),
    ).rejects.toBeInstanceOf(ProviderUncertainFailure);
  });

  it("merges provider timeout AbortSignal with the caller signal", async () => {
    const create = vi.fn(async (_body, opts) => {
      expect(opts?.signal).toBeInstanceOf(AbortSignal);
      // Caller not aborted yet; timeout signal is still part of the merge.
      expect(opts?.signal?.aborted).toBe(false);
      return stubResponse({ output_text: "ok" });
    });
    const provider = createOpenAiProvider({
      env: baseEnv({ AI_OPENAI_TIMEOUT_MS: 30_000 }),
      client: { responses: { create } },
    });
    const ac = new AbortController();
    await provider.complete({
      feature: "chat",
      messages: [{ role: "user", content: "x" }],
      signal: ac.signal,
    });
    expect(create).toHaveBeenCalledOnce();
  });
});
