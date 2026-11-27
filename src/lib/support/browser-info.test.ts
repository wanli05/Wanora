import { describe, expect, it } from "vitest";
import { detectBrowserInfo } from "@/lib/support/browser-info";

describe("detectBrowserInfo", () => {
  it("detects Chrome", () => {
    expect(
      detectBrowserInfo(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ),
    ).toEqual({ name: "Chrome", version: "120.0.0.0" });
  });

  it("detects Edge before Chrome", () => {
    expect(
      detectBrowserInfo(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
      ),
    ).toEqual({ name: "Edge", version: "120.0.0.0" });
  });

  it("returns null for empty UA", () => {
    expect(detectBrowserInfo("")).toBeNull();
    expect(detectBrowserInfo(null)).toBeNull();
  });
});
