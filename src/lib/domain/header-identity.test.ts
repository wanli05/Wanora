import { describe, expect, it } from "vitest";
import { headerAvatarInitial, headerDisplayName } from "./header-identity";

describe("headerDisplayName", () => {
  it("prefers profile Japanese fullName", () => {
    expect(
      headerDisplayName({
        fullName: { ja: "山田 太郎" },
        sessionName: "Auth Name",
      }),
    ).toBe("山田 太郎");
  });

  it("falls back to session name when it is not an email", () => {
    expect(
      headerDisplayName({
        fullName: {},
        sessionName: "山田 太郎",
      }),
    ).toBe("山田 太郎");
  });

  it("does not use email-like session name as the primary label", () => {
    expect(
      headerDisplayName({
        fullName: null,
        sessionName: "user@example.com",
      }),
    ).toBe("");
  });
});

describe("headerAvatarInitial", () => {
  it("returns the first grapheme", () => {
    expect(headerAvatarInitial("山田 太郎")).toBe("山");
  });

  it("returns empty for blank names", () => {
    expect(headerAvatarInitial("  ")).toBe("");
  });
});
