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

      const mappedUsage = mapOpenAiUsage(response.usage);
      const text = extractOutputText(response);
      const latencyMs = Math.max(1, Date.now() - started);

      // Vendor omitted usage → unknown cost. Hold budget; never settle as $0 or auto-retry.
      if (!mappedUsage.present) {
        throw new ProviderUncertainFailure(
          "openai returned no usage metadata",
          "usage_unknown",
        );
      }

      const usage = mappedUsage.mapped;
      const scrubbed = mappedUsage.scrubbed;
      const resultBase = {
        usage,
        provider: OPENAI_PROVIDER_ID,
        model: response.model || model || AI_B1_DEFAULT_MODEL,
        latencyMs,
        providerResponseId: response.id,
        rawUsage: scrubbed,
      };

      // Only a completed Responses payload may become a successful assistant reply.
      // Incomplete (even with partial text) must not succeed; preserve usage for settle.
      if (response.status === "incomplete") {
        if (usageLooksPresent(usage)) {
          return {
            // Keep partial text for audit payload; execute rejects it as assistant output.
            text,
            ...resultBase,
            rawUsage: { ...scrubbed, response_status: "incomplete" },
            rejectReason: "incomplete" as const,
          };
        }
        throw new ProviderCleanFailure(
          "openai returned incomplete output without usage",
          "incomplete_output",
        );
      }

      if (response.status && response.status !== "completed") {
        if (usageLooksPresent(usage)) {
          // Non-completed, non-incomplete statuses with usage: bill, do not succeed.
          return {
            text: "",
            ...resultBase,
            rawUsage: {
              ...scrubbed,
              response_status: String(response.status),
            },
            rejectReason: "incomplete" as const,
          };
        }
        throw new ProviderCleanFailure(
          `openai response status ${response.status}`,
          "invalid_output",
        );
      }

      if (!text) {
        if (usageLooksPresent(usage)) {
          // B1b: return empty text + usage so execute/guard can settle actual cost
          // (do not hold as uncertain for 24h reconcile).
          return {
            text: "",
            ...resultBase,
          };
        }
        throw new ProviderCleanFailure(
          "openai returned empty output",
          "invalid_output",
        );
      }

      // Completed text with present-but-zero usage: still unknown — do not settle $0.
      if (!usageLooksPresent(usage)) {
        throw new ProviderUncertainFailure(
          "openai returned text without billable usage tokens",
          "usage_unknown",
        );
      }

      return {
        text,
        ...resultBase,
      };
    },
  };
}
