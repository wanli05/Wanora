import { describe, expect, it } from "vitest";
import {
  PROFILE_MODULE_FIELD_IDS,
  PROJECT_MODULE_FIELD_IDS,
  REFINE_BODY_END,
  REFINE_BODY_START,
  REFINE_LABELED_BODY_END,
  REFINE_RESULT_END,
  REFINE_RESULT_START,
  assistSlotKeyForRefineField,
  buildModuleRefinePrompt,
  buildRefinePrompt,
  refineFeatureForField,
  refineLabeledBodyStart,
  refineLabeledResultStart,
  serializeModuleDrafts,
  targetForRefineField,
} from "./refine-prompts";

describe("refine-prompts", () => {
  it("embeds the latest draft body as the primary source", () => {
    const prompt = buildRefinePrompt({
      feature: "self_pr_refine",
      draftText: "未保存の自己PR草稿",
    });
    expect(prompt).toContain(REFINE_BODY_START);
    expect(prompt).toContain("未保存の自己PR草稿");
    expect(prompt).toContain(REFINE_BODY_END);
    expect(prompt).toContain(REFINE_RESULT_START);
    expect(prompt).toContain(REFINE_RESULT_END);
    expect(prompt).toContain("創作しない");
  });

  it("marks limited context for unsaved records", () => {
    const prompt = buildRefinePrompt({
      feature: "career_project_refine",
      draftText: "概要",
      limitedContext: true,
    });
    expect(prompt).toContain("未保存");
  });

  it("maps field keys to features and targets", () => {
    expect(refineFeatureForField("selfPr_ja")).toBe("self_pr_refine");
    expect(refineFeatureForField("profile_module")).toBe(
      "profile_module_refine",
    );
    expect(refineFeatureForField("project_module")).toBe(
      "career_project_refine",
    );
    expect(refineFeatureForField("narrative_ja")).toBe(
      "career_employer_narrative_refine",
    );
    expect(targetForRefineField("selfPr_ja", null)).toEqual({
      type: "profile",
      section: "self_pr",
    });
    expect(targetForRefineField("profile_module", null)).toEqual({
      type: "profile",
      section: "module",
    });
    expect(targetForRefineField("narrative_ja", "emp-1")).toEqual({
      type: "career_employer",
      id: "emp-1",
    });
    expect(targetForRefineField("narrative_ja", null)).toBeNull();
    expect(targetForRefineField("overview_ja", "")).toBeNull();
    expect(targetForRefineField("project_module", "proj-1")).toEqual({
      type: "career_project",
      id: "proj-1",
    });
  });

  it("builds assist slot keys per field / record / draft", () => {
    expect(assistSlotKeyForRefineField("selfPr_ja", null)).toBe(
      "refine:profile:self_pr",
    );
    expect(assistSlotKeyForRefineField("jobSummary_ja", null)).toBe(
      "refine:profile:job_summary",
    );
    expect(assistSlotKeyForRefineField("profile_module", null)).toBe(
      "refine:profile:module",
    );
    expect(
      assistSlotKeyForRefineField(
        "narrative_ja",
        "11111111-1111-4111-8111-111111111111",
      ),
    ).toBe("refine:career_employer:11111111-1111-4111-8111-111111111111");
    expect(
      assistSlotKeyForRefineField(
        "project_module",
        null,
        "22222222-2222-4222-8222-222222222222",
      ),
    ).toBe(
      "refine:career_project:draft:22222222-2222-4222-8222-222222222222",
    );
    expect(assistSlotKeyForRefineField("project_module", null, null)).toBeNull();
  });

  it("builds labeled multi-field module prompts", () => {
    const prompt = buildModuleRefinePrompt({
      feature: "profile_module_refine",
      fieldIds: PROFILE_MODULE_FIELD_IDS,
      drafts: {
        self_pr: "PR草稿",
        job_summary: "要約草稿",
        strengths: "経験1\n経験2",
      },
    });
    for (const id of PROFILE_MODULE_FIELD_IDS) {
      expect(prompt).toContain(refineLabeledBodyStart(id));
      expect(prompt).toContain(refineLabeledResultStart(id));
    }
    expect(prompt).toContain(REFINE_LABELED_BODY_END);
    expect(prompt).toContain("PR草稿");
    expect(prompt).toContain("経験1\n経験2");
    expect(prompt).not.toContain(REFINE_BODY_START);
  });

  it("serializes module drafts stably for overwrite detection", () => {
    expect(
      serializeModuleDrafts(PROJECT_MODULE_FIELD_IDS, {
        overview: "a",
        results: "r",
      }),
    ).toBe(
      JSON.stringify({
        overview: "a",
        phases: "",
        responsibilities: "",
        results: "r",
      }),
    );
  });
});
