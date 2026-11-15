import { createMyCareerContextSource } from "@/lib/ai/context/sources/my-career";
import type { AiContextSource } from "@/lib/ai/context/types";

const defaultSources: AiContextSource[] = [createMyCareerContextSource()];

/** Built-in Phase 1A sources. Application / Interview register in later phases. */
export function getDefaultAiContextSources(): AiContextSource[] {
  return [...defaultSources];
}

export function createAiContextRegistry(
  sources: AiContextSource[] = getDefaultAiContextSources(),
) {
  const map = new Map(sources.map((s) => [s.id, s]));
  return {
    list(): AiContextSource[] {
      return [...map.values()];
    },
    get(id: string): AiContextSource | undefined {
      return map.get(id);
    },
    register(source: AiContextSource) {
      if (map.has(source.id)) {
        throw new Error(`ContextSource already registered: ${source.id}`);
      }
      map.set(source.id, source);
    },
  };
}
