import type { Db } from "@/db";

/** Weak hint that follows the current route. Never authoritative for writes. */
export type AiPageContext = {
  path: string;
  /** Coarse area hint for source selection. */
  area?: "my_career" | "board" | "other";
  label?: string;
};

/**
 * Explicit business target the user locked for AI help.
 * Page navigation must not overwrite this — use `applyPageNavigation`.
 */
export type AiTargetContext =
  | { type: "profile"; section?: ProfileTargetSection }
  | { type: "career_project"; id: string }
  | { type: "education"; id: string }
  | { type: "work_history"; id: string }
  | { type: "license"; id: string }
  | { type: "career_employer"; id: string };

export type ProfileTargetSection =
  | "self_pr"
  | "job_summary"
  | "headline"
  | "overview"
  /** Module-level Profile refine (self_pr + job_summary + strengths). */
  | "module";

/** Conversation thread identity — separate from Page/Target. */
export type AiConversationRef = {
  conversationId?: string | null;
};

export type AiContextResolveInput = {
  /** Must come from session (`getSessionUser`), never from client body. */
  userId: string;
  pageContext?: AiPageContext | null;
  targetContext?: AiTargetContext | null;
  conversation?: AiConversationRef | null;
  /** Limit which registered sources run; default = all that `supports`. */
  sourceIds?: string[];
  maxChars?: number;
};

export type AiContextFragment = {
  sourceId: string;
  /** Stable section key within the source (e.g. profile, projects). */
  section: string;
  /** Human-readable label for prompt / UI attribution. */
  label: string;
  data: unknown;
  charCount: number;
  /** True when this fragment's payload was shortened. */
  truncated?: boolean;
  /** Why data is incomplete (e.g. target not found / empty). */
  notes?: string[];
};

export type ResolvedAiContext = {
  pageContext: AiPageContext | null;
  targetContext: AiTargetContext | null;
  /** True when the caller passed an explicit Target (locked). */
  targetLocked: boolean;
  conversationId: string | null;
  fragments: AiContextFragment[];
  totalChars: number;
  truncated: boolean;
  warnings: string[];
};

export type ContextSourceSupportArgs = {
  pageContext: AiPageContext | null;
  targetContext: AiTargetContext | null;
};

export type ContextSourceLoadArgs = {
  db: Db;
  userId: string;
  pageContext: AiPageContext | null;
  targetContext: AiTargetContext | null;
};

/** Pluggable loader — register new domains without changing the resolver core. */
export interface AiContextSource {
  readonly id: string;
  supports(args: ContextSourceSupportArgs): boolean;
  load(args: ContextSourceLoadArgs): Promise<AiContextFragment[]>;
}
