import { describe, expect, it } from "vitest";
import {
  canApplyToProfileDraft,
  canApplyToRecordDraft,
} from "./assist-apply-guard";

describe("canApplyToRecordDraft", () => {
  it("allows apply when mounted, open, and ids match", () => {
    expect(
      canApplyToRecordDraft({
        mounted: true,
        editorOpen: true,
        currentRecordId: "emp-a",
        expectedRecordId: "emp-a",
      }),
    ).toBe(true);
  });

  it("rejects when record switched", () => {
    expect(
      canApplyToRecordDraft({
        mounted: true,
        editorOpen: true,
        currentRecordId: "emp-b",
        expectedRecordId: "emp-a",
      }),
    ).toBe(false);
  });

  it("rejects when editor closed or unmounted", () => {
    expect(
      canApplyToRecordDraft({
        mounted: true,
        editorOpen: false,
        currentRecordId: "emp-a",
        expectedRecordId: "emp-a",
      }),
    ).toBe(false);
    expect(
      canApplyToRecordDraft({
        mounted: false,
        editorOpen: true,
        currentRecordId: "emp-a",
        expectedRecordId: "emp-a",
      }),
    ).toBe(false);
  });

  it("allows unsaved new only while still on empty id", () => {
    expect(
      canApplyToRecordDraft({
        mounted: true,
        editorOpen: true,
        currentRecordId: "",
        expectedRecordId: null,
      }),
    ).toBe(true);
    expect(
      canApplyToRecordDraft({
        mounted: true,
        editorOpen: true,
        currentRecordId: "emp-a",
        expectedRecordId: null,
      }),
    ).toBe(false);
  });
});

describe("canApplyToProfileDraft", () => {
  it("requires mounted open editor", () => {
    expect(canApplyToProfileDraft({ mounted: true, editorOpen: true })).toBe(
      true,
    );
    expect(canApplyToProfileDraft({ mounted: true, editorOpen: false })).toBe(
      false,
    );
    expect(canApplyToProfileDraft({ mounted: false, editorOpen: true })).toBe(
      false,
    );
  });
});
