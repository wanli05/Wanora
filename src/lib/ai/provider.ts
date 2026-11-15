import { getServerEnv } from "@/lib/env";
import { createMockAiProvider } from "@/lib/ai/providers/mock";
import type { AiProvider } from "@/lib/ai/types";

/**
 * Resolve the configured provider. Phase 1A only ships mock.
 * Future real providers register here without changing call sites.
 */
export function getAiProvider(): AiProvider {
  const env = getServerEnv();
  switch (env.AI_PROVIDER) {
    case "mock":
      return createMockAiProvider();
    default: {
      const _exhaustive: never = env.AI_PROVIDER;
      return _exhaustive;
    }
  }
}
