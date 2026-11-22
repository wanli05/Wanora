import type {
  AiCompletionRequest,
  AiCompletionResult,
  AiProvider,
} from "@/lib/ai/types";
import { estimateCostUsd } from "@/lib/ai/pricing/estimate";

const MOCK_MODEL = "mock-v1";

/**
 * Step 4C Mock Scheme A — **re-implementation** (not recovered original source).
 *
 * Windows / Agent 备份未找到 Step 2 原文 `mock.ts` / `mock.test.ts`。
 * 本文件依据 Step 1/2 已确认契约重新编写，刻意标注为新实现，不得冒充历史源码。
 *
 * Contract (Scheme A):
 * - Only the four approved refine features (or prompts that already carry
 *   【添削対象本文】 markers) emit a single 【修正案】…【修正案ここまで】 pair.
 * - Body is taken from the *last* 【添削対象本文】…【添削対象本文ここまで】 block
 *   (COMMON_RULES / buildRefinePrompt also mention the phrase earlier).
 * - Refined text is deterministic: `（モック修正案）` + target body.
 * - Empty / placeholder / malformed target → short guidance inside one pair;
 *   never dump the full system/user prompt into the 修正案.
 * - Nested result markers in the target body are stripped so output has exactly
 *   one start/end pair (required by fail-closed `extractRefinedText`).
 * - Ordinary Mock chat keeps 【モック応答】 behavior.
 *
 * Must stay aligned with:
 * - `src/components/ai-sidebar/refine-prompts.ts` marker constants
 * - `extractRefinedText` fail-closed parsing (do not relax)
 * - E2E `MOCK_REFINE_PREFIX = "（モック修正案）"`
 */

/** Keep in sync with refine-prompts.ts */
const REFINE_BODY_START = "【添削対象本文】";
const REFINE_BODY_END = "【添削対象本文ここまで】";
const REFINE_RESULT_START = "【修正案】";
const REFINE_RESULT_END = "【修正案ここまで】";

/** Prefix required by Phase 1C E2E / Apply smoke (Scheme A). */
export const MOCK_REFINE_TEXT_PREFIX = "（モック修正案）";

const APPROVED_REFINE_FEATURES = new Set([
  "self_pr_refine",
  "job_summary_refine",
  "career_employer_narrative_refine",
  "career_project_refine",
]);

/** Matches refine-prompts empty-body placeholder (ja). */
const EMPTY_BODY_PLACEHOLDER =
  "（本文は空です。不足点の確認と書き方の提案のみ行ってください。）";

const EMPTY_BODY_GUIDANCE =
  `${MOCK_REFINE_TEXT_PREFIX}本文が空のため、書き方の確認と不足点の洗い出しを先に行ってください。`;

const MALFORMED_BODY_GUIDANCE =
  `${MOCK_REFINE_TEXT_PREFIX}添削対象の本文マーカーが不完全です。対象本文を確認してください。`;

function estimateTokens(text: string): number {
  // Rough CJK-friendly estimate: ~1 token per 2 chars, min 1 when non-empty.
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 2));
}

type TargetExtract =
  | { kind: "ok"; body: string }
  | { kind: "empty" }
  | { kind: "malformed" }
  | { kind: "absent" };

/**
 * Extract refine target from the last body-marker pair in user content.
 * Uses lastIndexOf so earlier mentions in COMMON_RULES / format examples are ignored.
 */
export function extractMockRefineTarget(userContent: string): TargetExtract {
  const start = userContent.lastIndexOf(REFINE_BODY_START);
  if (start < 0) return { kind: "absent" };

  const afterStart = start + REFINE_BODY_START.length;
  const end = userContent.indexOf(REFINE_BODY_END, afterStart);
  if (end < 0) return { kind: "malformed" };

  const body = userContent.slice(afterStart, end).trim();
  if (!body || body === EMPTY_BODY_PLACEHOLDER) return { kind: "empty" };
  return { kind: "ok", body };
}

function stripNestedResultMarkers(text: string): string {
  return text
    .split(REFINE_RESULT_START)
    .join("")
    .split(REFINE_RESULT_END)
    .join("")
    .trim();
}

function wrapRefineResult(inner: string): string {
  const cleaned = stripNestedResultMarkers(inner);
  const body = cleaned.length > 0 ? cleaned : EMPTY_BODY_GUIDANCE;
  return `${REFINE_RESULT_START}\n${body}\n${REFINE_RESULT_END}`;
}

function shouldEmitRefineContract(
  feature: string,
  userContent: string,
): boolean {
  if (APPROVED_REFINE_FEATURES.has(feature)) return true;
  return userContent.includes(REFINE_BODY_START);
}

function buildRefineReply(userContent: string): string {
  const extracted = extractMockRefineTarget(userContent);
  switch (extracted.kind) {
    case "ok":
      return wrapRefineResult(
        `${MOCK_REFINE_TEXT_PREFIX}${stripNestedResultMarkers(extracted.body)}`,
      );
    case "empty":
      return wrapRefineResult(EMPTY_BODY_GUIDANCE);
    case "malformed":
    case "absent":
      return wrapRefineResult(MALFORMED_BODY_GUIDANCE);
  }
}

function buildChatReply(userContent: string): string {
  const snippet = userContent.trim().slice(0, 80);
  return snippet
    ? `【モック応答】ご入力を受け取りました：${snippet}`
    : "【モック応答】メッセージを入力してください。";
}

function buildReply(request: AiCompletionRequest): string {
  const lastUser = [...request.messages].reverse().find((m) => m.role === "user");
  const userContent = lastUser?.content ?? "";
  if (shouldEmitRefineContract(request.feature, userContent)) {
    return buildRefineReply(userContent);
  }
  return buildChatReply(userContent);
}

/**
 * Deterministic mock provider — no network. Safe for CI and local without keys.
 * Scheme A refine contract is a Step 4C re-implementation (see file header).
 */
export function createMockAiProvider(): AiProvider {
  return {
    id: "mock",
    async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
      if (request.signal?.aborted) {
        const err = new Error("aborted");
        err.name = "AbortError";
        throw err;
      }
      const started = Date.now();
      const inputText = request.messages.map((m) => m.content).join("\n");
      const text = buildReply(request);

      const inputTokens = estimateTokens(inputText);
      const outputTokens = estimateTokens(text);
      const latencyMs = Math.max(1, Date.now() - started);

      return {
        text,
        usage: { inputTokens, outputTokens },
        provider: "mock",
        model: request.model?.trim() || MOCK_MODEL,
        latencyMs,
      };
    },
  };
}

/**
 * Legacy helper: treat `tokens` as ordinary input on mock-v1 ($10 / 1M).
 * Prefer estimateCostUsd for new code paths.
 */
export function mockEstimatedCostUsd(tokens: number): string {
  return estimateCostUsd({
    model: MOCK_MODEL,
    usage: { inputTokens: tokens, outputTokens: 0 },
  }).estimatedCostUsd;
}
