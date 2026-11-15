import { describe, expect, it } from "vitest";
import { pageContextFromPath } from "./page-context";

describe("pageContextFromPath", () => {
  it("maps home to board and profile to my_career", () => {
    expect(pageContextFromPath("/ja")).toMatchObject({ area: "board" });
    expect(pageContextFromPath("/ja/")).toMatchObject({ area: "board" });
    expect(pageContextFromPath("/zh-CN/profile")).toMatchObject({
      area: "my_career",
    });
    expect(pageContextFromPath("/en/profile/education")).toMatchObject({
      area: "my_career",
    });
  });

  it("keeps full path including locale prefix", () => {
    const ctx = pageContextFromPath("/ja/profile");
    expect(ctx.path).toBe("/ja/profile");
  });
});
