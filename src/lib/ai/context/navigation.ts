import type { AiPageContext, AiTargetContext } from "@/lib/ai/context/types";

export type NavigationState = {
  pageContext: AiPageContext | null;
  targetContext: AiTargetContext | null;
};

/**
 * Page route changes update PageContext only.
 * TargetContext changes require an explicit `target` / `clearTarget` action —
 * never inferred from `page`.
 */
export function applyPageNavigation(
  previous: NavigationState,
  update: {
    page?: AiPageContext | null;
    /** Set only when the user explicitly picks / confirms a target. */
    target?: AiTargetContext | null;
    clearTarget?: boolean;
  },
): NavigationState {
  let targetContext = previous.targetContext;

  if (update.clearTarget) {
    targetContext = null;
  } else if (update.target !== undefined) {
    targetContext = update.target;
  }
  // `page` must not touch targetContext.

  return {
    pageContext:
      update.page !== undefined ? update.page : previous.pageContext,
    targetContext,
  };
}

export function targetsEqual(
  a: AiTargetContext | null | undefined,
  b: AiTargetContext | null | undefined,
): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (a.type !== b.type) return false;
  if (a.type === "profile" && b.type === "profile") {
    return (a.section ?? null) === (b.section ?? null);
  }
  if ("id" in a && "id" in b) {
    return a.id === b.id;
  }
  return false;
}
