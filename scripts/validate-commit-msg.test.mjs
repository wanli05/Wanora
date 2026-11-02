import { describe, expect, it } from "vitest";
import { validateCommitMessage } from "./validate-commit-message.mjs";

describe("validateCommitMessage", () => {
  it("rejects empty subjects", () => {
    expect(validateCommitMessage("\n")).toMatch(/empty/i);
  });

  it("rejects placeholder subjects", () => {
    for (const subject of ["wip", "fix", "update", "changes"]) {
      expect(validateCommitMessage(subject)).toMatch(/vague/i);
    }
  });

  it("accepts descriptive subjects", () => {
    expect(
      validateCommitMessage("M2: add Docker image and deploy workflow scaffold"),
    ).toBeNull();
  });
});
