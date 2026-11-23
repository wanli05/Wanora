import type {
  AiCompletionRequest,
  AiCompletionResult,
  AiProvider,
} from "@/lib/ai/types";
import { estimateCostUsd } from "@/lib/ai/pricing/estimate";

const MOCK_MODEL = "mock-v1";

/**
 * Mock Scheme A (+ module multi-field extension).
 *
 * Single-field (legacy):
 * - Features self_pr / job_summary / career_employer_narrative, or unlabeled
 *   【添削対象本文】 markers → one unlabeled 【修正案】 pair.
 *
 * Multi-field modules:
 * - profile_module_refine / career_project_refine with labeled
 *   【添削対象:id】 blocks → labeled 【修正案:id】 pairs (omit empty drafts).
 *
 * Must stay aligned with refine-prompts markers + extractRefinedText/Fields.
 */

const REFINE_BODY_START = "【添削対象本文】";
const REFINE_BODY_END = "【添削対象本文ここまで】";
const REFINE_RESULT_START = "【修正案】";
const REFINE_RESULT_END = "【修正案ここまで】";
const REFINE_LABELED_BODY_END = "【添削対象ここまで】";

/** Prefix required by Phase 1C E2E / Apply smoke (Scheme A). */
export const MOCK_REFINE_TEXT_PREFIX = "（モック修正案）";

const SINGLE_REFINE_FEATURES = new Set([
  "self_pr_refine",
  "job_summary_refine",
  "career_employer_narrative_refine",
]);

const MODULE_REFINE_FEATURES = new Set([
  "profile_module_refine",
  "career_project_refine",
]);

const PROFILE_FIELD_IDS = ["self_pr", "job_summary", "strengths"] as const;
const PROJECT_FIELD_IDS = [
  "overview",
  "phases",
  "responsibilities",
  "results",
] as const;

const EMPTY_BODY_PLACEHOLDER =
  "（本文は空です。不足点の確認と書き方の提案のみ行ってください。）";

const EMPTY_BODY_GUIDANCE =
  `${MOCK_REFINE_TEXT_PREFIX}本文が空のため、書き方の確認と不足点の洗い出しを先に行ってください。`;

const MALFORMED_BODY_GUIDANCE =
  `${MOCK_REFINE_TEXT_PREFIX}添削対象の本文マーカーが不完全です。対象本文を確認してください。`;

function estimateTokens(text: string): number {
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
 * Extract refine target from the last unlabeled body-marker pair in user content.
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

function wrapLabeledRefineResult(fieldId: string, inner: string): string {
  const cleaned = stripNestedResultMarkers(inner)
    .replace(new RegExp(`【修正案:${fieldId}】`, "gi"), "")
    .trim();
  const body = cleaned.length > 0 ? cleaned : EMPTY_BODY_GUIDANCE;
  return `【修正案:${fieldId}】\n${body}\n${REFINE_RESULT_END}`;
}

function extractLabeledBody(
  userContent: string,
  fieldId: string,
): TargetExtract {
  const startTag = `【添削対象:${fieldId}】`;
  const start = userContent.lastIndexOf(startTag);
  if (start < 0) return { kind: "absent" };
  const afterStart = start + startTag.length;
  const end = userContent.indexOf(REFINE_LABELED_BODY_END, afterStart);
  if (end < 0) return { kind: "malformed" };
  const body = userContent.slice(afterStart, end).trim();
  if (!body || body === EMPTY_BODY_PLACEHOLDER) return { kind: "empty" };
  return { kind: "ok", body };
}

function buildModuleRefineReply(
  feature: string,
  userContent: string,
): string {
  const fieldIds =
    feature === "profile_module_refine" ? PROFILE_FIELD_IDS : PROJECT_FIELD_IDS;
  // Legacy project overview path: unlabeled body only → single unlabeled pair.
  if (
    feature === "career_project_refine" &&
    !/【添削対象:[a-z0-9_]+】/i.test(userContent) &&
    userContent.includes(REFINE_BODY_START)
  ) {
    return buildRefineReply(userContent);
  }
  const blocks: string[] = [];
  let sawMalformed = false;
  for (const id of fieldIds) {
    const extracted = extractLabeledBody(userContent, id);
    if (extracted.kind === "malformed") {
      sawMalformed = true;
      continue;
    }
    if (extracted.kind === "ok") {
      blocks.push(
        wrapLabeledRefineResult(
          id,
          `${MOCK_REFINE_TEXT_PREFIX}${stripNestedResultMarkers(extracted.body)}`,
        ),
      );
    }
    // empty / absent → omit pair (partial apply / no overwrite)
  }
  if (blocks.length > 0) return blocks.join("\n");
  if (sawMalformed) {
    return wrapLabeledRefineResult(fieldIds[0]!, MALFORMED_BODY_GUIDANCE);
  }
  // All empty: emit guidance on first field only so Apply still has one pair.
  return wrapLabeledRefineResult(fieldIds[0]!, EMPTY_BODY_GUIDANCE);
}

function shouldEmitModuleRefine(
  feature: string,
  userContent: string,
): boolean {
  if (MODULE_REFINE_FEATURES.has(feature)) return true;
  return /【添削対象:[a-z0-9_]+】/i.test(userContent);
}

function shouldEmitSingleRefine(
  feature: string,
  userContent: string,
): boolean {
  if (SINGLE_REFINE_FEATURES.has(feature)) return true;
  // Unlabeled body without labeled bodies → legacy single refine.
  return (
    userContent.includes(REFINE_BODY_START) &&
    !/【添削対象:[a-z0-9_]+】/i.test(userContent)
  );
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
  if (shouldEmitModuleRefine(request.feature, userContent)) {
    return buildModuleRefineReply(request.feature, userContent);
  }
  if (shouldEmitSingleRefine(request.feature, userContent)) {
    return buildRefineReply(userContent);
  }
  return buildChatReply(userContent);
}

/**
 * Deterministic mock provider — no network. Safe for CI and local without keys.
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
