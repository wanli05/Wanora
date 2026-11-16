import { getServerEnv } from "@/lib/env";
import { createMockAiProvider } from "@/lib/ai/providers/mock";
import { createOpenAiProvider } from "@/lib/ai/providers/openai";
import type { AiProvider } from "@/lib/ai/types";

/**
 * Resolve the configured provider.
 * Phase 1B B1a: mock (default) + openai Responses adapter.
 */
export function getAiProvider(): AiProvider {
  const env = getServerEnv();
  switch (env.AI_PROVIDER) {
    case "mock":
      return createMockAiProvider();
    case "openai":
      return createOpenAiProvider({ env });
    default: {
      const _exhaustive: never = env.AI_PROVIDER;
      return _exhaustive;
    }
  }
}
