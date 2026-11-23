import type { AiTargetContext } from "@/lib/ai/context/types";
import {
  assistSlotKeyForCareerEmployer,
  assistSlotKeyForCareerEmployerDraft,
  assistSlotKeyForCareerProject,
  assistSlotKeyForCareerProjectDraft,
  assistSlotKeyForProfile,
  assistSlotKeyForProfileModule,
} from "@/lib/ai/conversation/assist-slot";

/** Client-only refine task ids (also sent as job `feature`). */
export type RefineFeature =
  | "self_pr_refine"
  | "job_summary_refine"
  | "career_employer_narrative_refine"
  | "career_project_refine"
  | "profile_module_refine";

export type RefineFieldKey =
  | "selfPr_ja"
  | "jobSummary_ja"
  | "narrative_ja"
  | "overview_ja"
  | "profile_module"
  | "project_module";

/** Stable ASCII field ids for multi-field refine protocol. */
export type RefineModuleFieldId =
  | "self_pr"
  | "job_summary"
  | "strengths"
  | "overview"
  | "phases"
  | "responsibilities"
  | "results";

export const PROFILE_MODULE_FIELD_IDS = [
  "self_pr",
  "job_summary",
  "strengths",
] as const satisfies readonly RefineModuleFieldId[];

export const PROJECT_MODULE_FIELD_IDS = [
  "overview",
  "phases",
  "responsibilities",
  "results",
] as const satisfies readonly RefineModuleFieldId[];

export const REFINE_BODY_START = "【添削対象本文】";
export const REFINE_BODY_END = "【添削対象本文ここまで】";
export const REFINE_RESULT_START = "【修正案】";
export const REFINE_RESULT_END = "【修正案ここまで】";

export function refineLabeledResultStart(fieldId: string): string {
  return `【修正案:${fieldId}】`;
}

export function refineLabeledBodyStart(fieldId: string): string {
  return `【添削対象:${fieldId}】`;
}

export const REFINE_LABELED_BODY_END = "【添削対象ここまで】";

const COMMON_RULES = [
  "自然で専門的な日本語に整えてください。",
  "ユーザーの実体験・事実のみを使い、職務・成果・スキル・資格・数字を創作しないでください。",
  "実際の職責や時系列を勝手に変えないでください。",
  "情報が不足する場合は【修正案】ブロックの外に補足質問を書き、本文へ推測で埋めないでください。",
  "参照コンテキストは補助情報です。添削の一次ソースは添削対象本文です。",
].join("\n");

const FEATURE_INTRO: Record<RefineFeature, string> = {
  self_pr_refine: "自己PRの文章を添削してください。",
  job_summary_refine: "職務要約の文章を添削してください。",
  career_employer_narrative_refine: "職歴（就業先）の叙述文を添削してください。",
  career_project_refine:
    "プロジェクトの概要・担当フェーズ・業務内容・実績を添削してください。",
  profile_module_refine:
    "プロフィールの自己PR・職務要約・活かせる経験を添削してください。",
};

export type BuildRefinePromptInput = {
  feature: RefineFeature;
  draftText: string;
  /** Optional extra instruction from caller. */
  promptSeed?: string;
  /** When true, warn that DB Target is unavailable (e.g. unsaved new row). */
  limitedContext?: boolean;
};

/**
 * Build a Japanese refine request that clearly separates draft body from instructions.
 * Does not call the network. Single-field (legacy) path.
 */
export function buildRefinePrompt(input: BuildRefinePromptInput): string {
  const body = input.draftText.trim();
  const limited = input.limitedContext
    ? "\n※この対象は未保存のため、参照コンテキストが限定的です。本文のみを根拠にしてください。\n"
    : "";
  const seed = input.promptSeed?.trim()
    ? `\n追加指示: ${input.promptSeed.trim()}\n`
    : "";

  return [
    FEATURE_INTRO[input.feature],
    "",
    COMMON_RULES,
    limited,
    seed,
    "出力形式（厳守）:",
    `${REFINE_RESULT_START}`,
    "（修正後の本文のみ。説明・質問を混ぜない）",
    `${REFINE_RESULT_END}`,
    "必要ならその後に「【補足】」として質問や注意を書いてください。",
    "",
    REFINE_BODY_START,
    body.length > 0 ? body : "（本文は空です。不足点の確認と書き方の提案のみ行ってください。）",
    REFINE_BODY_END,
  ].join("\n");
}

export type BuildModuleRefinePromptInput = {
  feature: "profile_module_refine" | "career_project_refine";
  fieldIds: readonly RefineModuleFieldId[];
  drafts: Readonly<Record<string, string>>;
  promptSeed?: string;
  limitedContext?: boolean;
};

/**
 * Multi-field module prompt: labeled body blocks + labeled result format.
 */
export function buildModuleRefinePrompt(
  input: BuildModuleRefinePromptInput,
): string {
  const limited = input.limitedContext
    ? "\n※この対象は未保存のため、参照コンテキストが限定的です。本文のみを根拠にしてください。\n"
    : "";
  const seed = input.promptSeed?.trim()
    ? `\n追加指示: ${input.promptSeed.trim()}\n`
    : "";

  const formatLines = [
    "出力形式（厳守）:",
    "変更するフィールドだけ、次のラベル付きブロックを出力してください。",
    "変更しないフィールドは出力しないでください（欠落フィールドは既存草稿を維持します）。",
    ...input.fieldIds.flatMap((id) => [
      refineLabeledResultStart(id),
      "（当該フィールドの修正後本文のみ）",
      REFINE_RESULT_END,
    ]),
    "必要ならすべての修正案ブロックの後に「【補足】」を書いてください。",
    "ラベルなしの【修正案】は使わないでください。",
  ];

  const bodyBlocks = input.fieldIds.map((id) => {
    const raw = (input.drafts[id] ?? "").trim();
    const body =
      raw.length > 0
        ? raw
        : "（本文は空です。不足点の確認と書き方の提案のみ行ってください。）";
    return [
      refineLabeledBodyStart(id),
      body,
      REFINE_LABELED_BODY_END,
    ].join("\n");
  });

  return [
    FEATURE_INTRO[input.feature],
    "",
    COMMON_RULES,
    limited,
    seed,
    ...formatLines,
    "",
    ...bodyBlocks,
  ].join("\n");
}

export function refineFeatureForField(fieldKey: RefineFieldKey): RefineFeature {
  switch (fieldKey) {
    case "selfPr_ja":
      return "self_pr_refine";
    case "jobSummary_ja":
      return "job_summary_refine";
    case "narrative_ja":
      return "career_employer_narrative_refine";
    case "overview_ja":
    case "project_module":
      return "career_project_refine";
    case "profile_module":
      return "profile_module_refine";
    default: {
      const _exhaustive: never = fieldKey;
      return _exhaustive;
    }
  }
}

export function targetForRefineField(
  fieldKey: RefineFieldKey,
  recordId: string | null | undefined,
): AiTargetContext | null {
  switch (fieldKey) {
    case "selfPr_ja":
      return { type: "profile", section: "self_pr" };
    case "jobSummary_ja":
      return { type: "profile", section: "job_summary" };
    case "profile_module":
      return { type: "profile", section: "module" };
    case "narrative_ja":
      if (!recordId) return null;
      return { type: "career_employer", id: recordId };
    case "overview_ja":
    case "project_module":
      if (!recordId) return null;
      return { type: "career_project", id: recordId };
    default: {
      const _exhaustive: never = fieldKey;
      return _exhaustive;
    }
  }
}

/**
 * Stable assist slot for a refine field.
 * Unsaved employer/project require `clientDraftKey` (per editor instance).
 */
export function assistSlotKeyForRefineField(
  fieldKey: RefineFieldKey,
  recordId: string | null | undefined,
  clientDraftKey?: string | null,
): string | null {
  switch (fieldKey) {
    case "selfPr_ja":
      return assistSlotKeyForProfile("self_pr");
    case "jobSummary_ja":
      return assistSlotKeyForProfile("job_summary");
    case "profile_module":
      return assistSlotKeyForProfileModule();
    case "narrative_ja":
      if (recordId) return assistSlotKeyForCareerEmployer(recordId);
      if (clientDraftKey) {
        return assistSlotKeyForCareerEmployerDraft(clientDraftKey);
      }
      return null;
    case "overview_ja":
    case "project_module":
      if (recordId) return assistSlotKeyForCareerProject(recordId);
      if (clientDraftKey) {
        return assistSlotKeyForCareerProjectDraft(clientDraftKey);
      }
      return null;
    default: {
      const _exhaustive: never = fieldKey;
      return _exhaustive;
    }
  }
}

export function defaultAssistTitle(fieldKey: RefineFieldKey): string {
  switch (fieldKey) {
    case "selfPr_ja":
      return "自己PR 添削";
    case "jobSummary_ja":
      return "職務要約 添削";
    case "narrative_ja":
      return "職歴 添削";
    case "overview_ja":
    case "project_module":
      return "プロジェクト 添削";
    case "profile_module":
      return "プロフィール 添削";
    default: {
      const _exhaustive: never = fieldKey;
      return _exhaustive;
    }
  }
}

export function moduleFieldIdsForFeature(
  feature: RefineFeature,
): readonly RefineModuleFieldId[] | null {
  if (feature === "profile_module_refine") return PROFILE_MODULE_FIELD_IDS;
  if (feature === "career_project_refine") return PROJECT_MODULE_FIELD_IDS;
  return null;
}

/** Canonical snapshot for multi-field overwrite detection. */
export function serializeModuleDrafts(
  fieldIds: readonly string[],
  drafts: Readonly<Record<string, string>>,
): string {
  const normalized: Record<string, string> = {};
  for (const id of fieldIds) {
    normalized[id] = drafts[id] ?? "";
  }
  return JSON.stringify(normalized);
}

export function moduleFieldLabelJa(fieldId: string): string {
  switch (fieldId) {
    case "self_pr":
      return "自己PR";
    case "job_summary":
      return "職務要約";
    case "strengths":
      return "活かせる経験";
    case "overview":
      return "概要";
    case "phases":
      return "担当フェーズ";
    case "responsibilities":
      return "業務内容";
    case "results":
      return "実績";
    default:
      return fieldId;
  }
}
