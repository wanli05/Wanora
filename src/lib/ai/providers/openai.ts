import OpenAI from "openai";
import type { Response as OpenAIResponse } from "openai/resources/responses/responses";
import {
  AI_B1_DEFAULT_MODEL,
  getServerEnv,
  resolveAiModel,
  type ServerEnv,
} from "@/lib/env";
import {
  ProviderCleanFailure,
  ProviderUncertainFailure,
} from "@/lib/ai/provider-errors";
import { mapOpenAiError } from "@/lib/ai/providers/openai-errors";
import { mapMessagesToOpenAiInput } from "@/lib/ai/providers/openai-messages";
import {
  mapOpenAiUsage,
  usageLooksPresent,
} from "@/lib/ai/providers/openai-usage";
import type {
  AiCompletionRequest,
  AiCompletionResult,
  AiProvider,
} from "@/lib/ai/types";

export const OPENAI_PROVIDER_ID = "openai";

/** Minimal client surface for tests (no network). */
export type OpenAiResponsesClient = {
  responses: {
    create: (
      body: Record<string, unknown>,
      options?: { signal?: AbortSignal | null },
    ) => Promise<OpenAIResponse>;
  };
};

export type CreateOpenAiProviderOptions = {
  env?: ServerEnv;
  client?: OpenAiResponsesClient;
  /**
   * Fixed product instructions (B1c wires the full template).
   * Kept separate from My Career context messages in `input`.
   */
  instructions?: string | null;
};

function combineSignals(
  user: AbortSignal | undefined,
  timeoutMs: number,
): AbortSignal {
  const timeout =
    typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(timeoutMs)
      : (() => {
          const c = new AbortController();
          setTimeout(() => c.abort(), timeoutMs);
          return c.signal;
        })();
  if (!user) return timeout;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([user, timeout]);
  }
  const merged = new AbortController();
  const onAbort = () => merged.abort();
  if (user.aborted || timeout.aborted) {
    merged.abort();
    return merged.signal;
  }
  user.addEventListener("abort", onAbort, { once: true });
  timeout.addEventListener("abort", onAbort, { once: true });
  return merged.signal;
}

function extractOutputText(response: OpenAIResponse): string {
  const direct = response.output_text?.trim() ?? "";
  if (direct) return direct;

  const parts: string[] = [];
  for (const item of response.output ?? []) {
    if (!item || typeof item !== "object") continue;
    if (!("content" in item) || !Array.isArray(item.content)) continue;
    for (const block of item.content) {
      if (
        block &&
        typeof block === "object" &&
        "type" in block &&
        block.type === "output_text" &&
        "text" in block &&
        typeof block.text === "string"
      ) {
        parts.push(block.text);
      }
    }
  }
  return parts.join("").trim();
}

/**
 * OpenAI Responses API adapter. Does not settle budgets (Job layer owns that).
 * Never logs message content or API keys.
 */
export function createOpenAiProvider(
  options: CreateOpenAiProviderOptions = {},
): AiProvider {
  const env = options.env ?? getServerEnv();
  if (!env.OPENAI_API_KEY && !options.client) {
    throw new Error("OPENAI_API_KEY is required for openai provider");
  }

  // Lazy client construction so importing/resolving the provider in unit tests
  // (jsdom) does not trip the SDK's browser credential guard.
  let client: OpenAiResponsesClient | undefined = options.client;
  const getClient = (): OpenAiResponsesClient => {
    if (client) return client;
    client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
    return client;
  };

  return {
    id: OPENAI_PROVIDER_ID,
    async complete(
      request: AiCompletionRequest,
    ): Promise<AiCompletionResult> {
      const started = Date.now();
      let model: string;
      try {
        model = resolveAiModel(request.model, env);
      } catch (err) {
        throw mapOpenAiError(err);
      }

      const input = mapMessagesToOpenAiInput(request.messages);
      if (input.length === 0) {
        throw new ProviderCleanFailure(
          "messages must not be empty",
          "invalid_request",
        );
      }

      const signal = combineSignals(
        request.signal,
        env.AI_OPENAI_TIMEOUT_MS,
      );

      const body: Record<string, unknown> = {
        model,
        input,
        max_output_tokens: env.AI_OPENAI_MAX_OUTPUT_TOKENS,
        store: false,
      };
      if (options.instructions?.trim()) {
        body.instructions = options.instructions.trim();
      }
      if (request.requestKey?.trim()) {
        body.metadata = { request_key: request.requestKey.trim().slice(0, 64) };
      }

      let response: OpenAIResponse;
      try {
        response = await getClient().responses.create(body, { signal });
      } catch (err) {
        throw mapOpenAiError(err);
      }

      const { mapped: usage, scrubbed } = mapOpenAiUsage(response.usage);
      const text = extractOutputText(response);
      const latencyMs = Math.max(1, Date.now() - started);
      const resultBase = {
        usage,
        provider: OPENAI_PROVIDER_ID,
        model: response.model || model || AI_B1_DEFAULT_MODEL,
        latencyMs,
        providerResponseId: response.id,
        rawUsage: scrubbed,
      };

      if (!text) {
        // Billing may have occurred — never treat as free clean release.
        if (usageLooksPresent(usage)) {
          throw new ProviderUncertainFailure(
            "openai returned usage but empty text",
            "empty_output_with_usage",
          );
        }
        throw new ProviderCleanFailure(
          "openai returned empty output",
          "invalid_output",
        );
      }

      return {
        text,
        ...resultBase,
      };
    },
  };
}
