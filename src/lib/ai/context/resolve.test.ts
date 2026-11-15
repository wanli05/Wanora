import { describe, expect, it } from "vitest";
import { createAiContextRegistry } from "@/lib/ai/context/registry";
import { createMyCareerContextSource } from "@/lib/ai/context/sources/my-career";
import type { AiContextSource } from "@/lib/ai/context/types";

describe("context registry", () => {
  it("registers only my_career by default", () => {
    const registry = createAiContextRegistry();
    expect(registry.list().map((s) => s.id)).toEqual(["my_career"]);
  });

  it("rejects duplicate source ids and allows future sources", () => {
    const registry = createAiContextRegistry([createMyCareerContextSource()]);
    const fake: AiContextSource = {
      id: "application",
      supports: () => false,
      load: async () => [],
    };
    registry.register(fake);
    expect(registry.get("application")).toBe(fake);
    expect(() => registry.register(fake)).toThrow(/already registered/);
  });

  it("my_career supports career page/target but not board-only page", () => {
    const source = createMyCareerContextSource();
    expect(
      source.supports({
        pageContext: { path: "/board", area: "board" },
        targetContext: null,
      }),
    ).toBe(false);
    expect(
      source.supports({
        pageContext: { path: "/career", area: "my_career" },
        targetContext: null,
      }),
    ).toBe(true);
    expect(
      source.supports({
        pageContext: { path: "/board", area: "board" },
        targetContext: { type: "profile", section: "self_pr" },
      }),
    ).toBe(true);
  });
});
