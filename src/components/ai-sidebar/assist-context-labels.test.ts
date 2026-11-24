import { describe, expect, it } from "vitest";
import {
  assistContextLabelKeys,
  shouldHideFocusAdjuster,
} from "./assist-context-labels";

describe("assistContextLabelKeys", () => {
  it("maps profile module to profile scope", () => {
    expect(assistContextLabelKeys("profile_module")).toEqual({
      referenceKey: "assistRefProfile",
      scopeKey: "assistScopeProfile",
    });
  });

  it("maps project module to project four-field scope", () => {
    expect(assistContextLabelKeys("project_module")).toEqual({
      referenceKey: "assistRefProject",
      scopeKey: "assistScopeProject",
    });
  });

  it("maps legacy project overview to single-field scope", () => {
    expect(assistContextLabelKeys("overview_ja")).toEqual({
      referenceKey: "assistRefProject",
      scopeKey: "assistScopeLegacyOverview",
    });
  });

  it("maps employer narrative to single-field scope", () => {
    expect(assistContextLabelKeys("narrative_ja")).toEqual({
      referenceKey: "assistRefEmployer",
      scopeKey: "assistScopeEmployer",
    });
  });

  it("maps legacy profile fields to single-field scopes", () => {
    expect(assistContextLabelKeys("selfPr_ja")).toEqual({
      referenceKey: "assistRefLegacyProfile",
      scopeKey: "assistScopeLegacySelfPr",
    });
    expect(assistContextLabelKeys("jobSummary_ja")).toEqual({
      referenceKey: "assistRefLegacyProfile",
      scopeKey: "assistScopeLegacyJobSummary",
    });
  });
});

describe("shouldHideFocusAdjuster", () => {
  it("hides for any My Career assist field, keeps general chat", () => {
    expect(shouldHideFocusAdjuster("profile_module")).toBe(true);
    expect(shouldHideFocusAdjuster("project_module")).toBe(true);
    expect(shouldHideFocusAdjuster("narrative_ja")).toBe(true);
    expect(shouldHideFocusAdjuster(null)).toBe(false);
    expect(shouldHideFocusAdjuster(undefined)).toBe(false);
  });
});
