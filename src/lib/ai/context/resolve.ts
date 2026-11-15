import type { Db } from "@/db";
import {
  createAiContextRegistry,
  getDefaultAiContextSources,
} from "@/lib/ai/context/registry";
import { trimContextFragments } from "@/lib/ai/context/trim";
import type {
  AiContextFragment,
  AiContextResolveInput,
  AiContextSource,
  ResolvedAiContext,
} from "@/lib/ai/context/types";
import { getServerEnv } from "@/lib/env";

export type ResolveAiContextOptions = {
  sources?: AiContextSource[];
  maxChars?: number;
};

/**
 * Assemble read-only AI context for the session user.
 * Does not write My Career tables. PageContext is informational only;
 * TargetContext is used as-is (callers must not overwrite it on navigation).
 */
export async function resolveAiContext(
  db: Db,
  input: AiContextResolveInput,
  options: ResolveAiContextOptions = {},
): Promise<ResolvedAiContext> {
  if (!input.userId?.trim()) {
    throw new Error("resolveAiContext requires session userId");
  }

  const env = getServerEnv();
  const maxChars =
    options.maxChars ?? input.maxChars ?? env.AI_MAX_CONTEXT_CHARS;
  const registry = createAiContextRegistry(
    options.sources ?? getDefaultAiContextSources(),
  );

  const pageContext = input.pageContext ?? null;
  const targetContext = input.targetContext ?? null;
  const conversationId = input.conversation?.conversationId ?? null;
  const warnings: string[] = [];

  const candidates = registry.list().filter((source) => {
    if (input.sourceIds && !input.sourceIds.includes(source.id)) {
      return false;
    }
    return source.supports({ pageContext, targetContext });
  });

  if (input.sourceIds) {
    for (const id of input.sourceIds) {
      if (!registry.get(id)) {
        warnings.push(`unknown_source:${id}`);
      } else if (!candidates.some((c) => c.id === id)) {
        warnings.push(`source_not_applicable:${id}`);
      }
    }
  }

  const loaded = await Promise.all(
    candidates.map((source) =>
      source.load({ db, userId: input.userId, pageContext, targetContext }),
    ),
  );

  const fragments: AiContextFragment[] = loaded.flat();
  const trimmed = trimContextFragments(fragments, maxChars);

  const hasSubstance = fragments.some((f) => {
    if (f.data == null) return false;
    if (Array.isArray(f.data) && f.data.length === 0) return false;
    if (f.notes?.includes("profile_empty")) return false;
    return true;
  });
  if (!hasSubstance) {
    warnings.push("career_data_sparse");
  }

  return {
    pageContext,
    targetContext,
    targetLocked: targetContext != null,
    conversationId,
    fragments: trimmed.fragments,
    totalChars: trimmed.totalChars,
    truncated: trimmed.truncated,
    warnings,
  };
}
