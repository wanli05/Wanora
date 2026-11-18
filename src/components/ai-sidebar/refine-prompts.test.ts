import { describe, expect, it } from "vitest";
import {
  REFINE_BODY_END,
  REFINE_BODY_START,
  REFINE_RESULT_END,
  REFINE_RESULT_START,
  buildRefinePrompt,
  refineFeatureForField,
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
    expect(refineFeatureForField("narrative_ja")).toBe(
      "career_employer_narrative_refine",
    );
    expect(targetForRefineField("selfPr_ja", null)).toEqual({
      type: "profile",
      section: "self_pr",
    });
    expect(targetForRefineField("narrative_ja", "emp-1")).toEqual({
      type: "career_employer",
      id: "emp-1",
    });
    expect(targetForRefineField("narrative_ja", null)).toBeNull();
    expect(targetForRefineField("overview_ja", "")).toBeNull();
    expect(targetForRefineField("overview_ja", "proj-1")).toEqual({
      type: "career_project",
      id: "proj-1",
    });
  });
});
