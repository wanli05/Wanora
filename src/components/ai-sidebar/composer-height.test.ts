import { describe, expect, it } from "vitest";
import {
  COMPOSER_DESKTOP_DEFAULT_PX,
  COMPOSER_MIN_HEIGHT_PX,
  COMPOSER_MOBILE_DEFAULT_PX,
  clampComposerHeight,
  composerDefaultHeightPx,
  composerExpandedPresetPx,
  composerMaxHeightPx,
  composerShowsCollapseControl,
  heightFromDrag,
  resolveComposerHeightPx,
} from "./composer-height";

describe("composer-height", () => {
  it("defaults desktop vs mobile", () => {
    expect(composerDefaultHeightPx(1280)).toBe(COMPOSER_DESKTOP_DEFAULT_PX);
    expect(composerDefaultHeightPx(390)).toBe(COMPOSER_MOBILE_DEFAULT_PX);
  });

  it("clamps and computes drag direction (up grows)", () => {
    expect(clampComposerHeight(50, 400)).toBe(COMPOSER_MIN_HEIGHT_PX);
    expect(clampComposerHeight(999, 300)).toBe(300);
    expect(heightFromDrag(160, 500, 450, 400)).toBe(210);
    expect(heightFromDrag(160, 500, 560, 400)).toBe(100);
  });

  it("resolveComposerHeightPx respects modes", () => {
    const base = {
      manualHeightPx: null as number | null,
      viewportWidthPx: 1280,
      viewportHeightPx: 800,
      panelHeightPx: 700,
    };
    expect(resolveComposerHeightPx({ ...base, mode: "default" })).toBe(160);
    const expanded = resolveComposerHeightPx({ ...base, mode: "expanded" });
    expect(expanded).toBe(composerExpandedPresetPx(800, composerMaxHeightPx(700, 800)));
    expect(
      resolveComposerHeightPx({
        ...base,
        mode: "manual",
        manualHeightPx: 280,
      }),
    ).toBe(280);
  });

  it("collapse control only when not default", () => {
    expect(composerShowsCollapseControl("default")).toBe(false);
    expect(composerShowsCollapseControl("expanded")).toBe(true);
    expect(composerShowsCollapseControl("manual")).toBe(true);
  });
});
