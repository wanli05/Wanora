import { describe, expect, it } from "vitest";
import {
  assistSlotKeyForCareerEmployer,
  assistSlotKeyForCareerEmployerDraft,
  assistSlotKeyForCareerProject,
  assistSlotKeyForProfile,
  parseAssistSlotKey,
  validateAssistRebindKeys,
  validateAssistSlotBinding,
} from "@/lib/ai/conversation/assist-slot";

const REC = "11111111-1111-4111-8111-111111111111";
const DRAFT = "22222222-2222-4222-8222-222222222222";

describe("assist-slot keys", () => {
  it("builds and parses profile / record / draft keys", () => {
    expect(parseAssistSlotKey(assistSlotKeyForProfile("self_pr"))).toEqual({
      kind: "profile",
      section: "self_pr",
    });
    expect(parseAssistSlotKey(assistSlotKeyForProfile("job_summary"))).toEqual({
      kind: "profile",
      section: "job_summary",
    });
    expect(
      parseAssistSlotKey(assistSlotKeyForCareerEmployer(REC)),
    ).toMatchObject({
      kind: "career_employer",
      mode: "record",
      recordId: REC,
    });
    expect(
      parseAssistSlotKey(assistSlotKeyForCareerEmployerDraft(DRAFT)),
    ).toMatchObject({
      kind: "career_employer",
      mode: "draft",
      clientDraftKey: DRAFT,
    });
    expect(
      parseAssistSlotKey(assistSlotKeyForCareerProject(REC)),
    ).toMatchObject({
      kind: "career_project",
      mode: "record",
      recordId: REC,
    });
  });

  it("rejects unknown keys", () => {
    expect(parseAssistSlotKey("refine:profile:headline")).toBeNull();
    expect(parseAssistSlotKey("profile:self_pr")).toBeNull();
    expect(parseAssistSlotKey("")).toBeNull();
  });
});

describe("validateAssistSlotBinding", () => {
  it("accepts matching profile / record / draft bindings", () => {
    expect(
      validateAssistSlotBinding("refine:profile:self_pr", {
        type: "profile",
        section: "self_pr",
      }).ok,
    ).toBe(true);
    expect(
      validateAssistSlotBinding(`refine:career_employer:${REC}`, {
        type: "career_employer",
        id: REC,
      }).ok,
    ).toBe(true);
    expect(
      validateAssistSlotBinding(`refine:career_employer:draft:${DRAFT}`, null)
        .ok,
    ).toBe(true);
  });

  it("rejects mismatched pin or fabricated ids on draft", () => {
    expect(
      validateAssistSlotBinding("refine:profile:self_pr", {
        type: "profile",
        section: "job_summary",
      }).ok,
    ).toBe(false);
    expect(
      validateAssistSlotBinding(`refine:career_employer:draft:${DRAFT}`, {
        type: "career_employer",
        id: REC,
      }).ok,
    ).toBe(false);
    expect(
      validateAssistSlotBinding(`refine:career_employer:${REC}`, null).ok,
    ).toBe(false);
  });
});

describe("validateAssistRebindKeys", () => {
  it("allows draft→record of the same entity kind", () => {
    const r = validateAssistRebindKeys(
      `refine:career_project:draft:${DRAFT}`,
      `refine:career_project:${REC}`,
    );
    expect(r).toEqual({
      ok: true,
      kind: "career_project",
      clientDraftKey: DRAFT,
      recordId: REC,
    });
  });

  it("rejects cross-kind or record→draft", () => {
    expect(
      validateAssistRebindKeys(
        `refine:career_employer:draft:${DRAFT}`,
        `refine:career_project:${REC}`,
      ).ok,
    ).toBe(false);
    expect(
      validateAssistRebindKeys(
        `refine:career_employer:${REC}`,
        `refine:career_employer:draft:${DRAFT}`,
      ).ok,
    ).toBe(false);
  });
});
