/** Pure helpers for AI Sidebar composer height (UI-only; not persisted). */

export type ComposerSizeMode = "default" | "manual" | "expanded";

export const COMPOSER_DESKTOP_DEFAULT_PX = 160;
export const COMPOSER_MOBILE_DEFAULT_PX = 120;
export const COMPOSER_MIN_HEIGHT_PX = 100;
/** Fraction of viewport height for one-click expand. */
export const COMPOSER_EXPAND_VH = 0.45;
/** Hard cap so expand never eats the whole panel. */
export const COMPOSER_EXPAND_CAP_PX = 420;
/**
 * Space reserved in the sidebar for chrome above/below the textarea
 * (header, conversation bar, messages min, context, send).
 */
export const COMPOSER_PANEL_RESERVED_PX = 240;

export function isComposerNarrowViewport(
  widthPx: number,
  breakpointPx = 640,
): boolean {
  return widthPx <= breakpointPx;
}

export function composerDefaultHeightPx(viewportWidthPx: number): number {
  return isComposerNarrowViewport(viewportWidthPx)
    ? COMPOSER_MOBILE_DEFAULT_PX
    : COMPOSER_DESKTOP_DEFAULT_PX;
}

export function composerExpandedPresetPx(
  viewportHeightPx: number,
  maxHeightPx: number,
): number {
  const raw = Math.min(
    viewportHeightPx * COMPOSER_EXPAND_VH,
    COMPOSER_EXPAND_CAP_PX,
  );
  return clampComposerHeight(raw, maxHeightPx);
}

export function composerMaxHeightPx(
  panelHeightPx: number,
  viewportHeightPx: number,
): number {
  // jsdom / pre-layout: panel height may be 0 — fall back to viewport fraction.
  const fromPanel =
    panelHeightPx > COMPOSER_PANEL_RESERVED_PX
      ? panelHeightPx - COMPOSER_PANEL_RESERVED_PX
      : viewportHeightPx * 0.45;
  const fromViewport = viewportHeightPx * 0.55;
  return Math.max(
    COMPOSER_MIN_HEIGHT_PX,
    Math.min(fromPanel, fromViewport, COMPOSER_EXPAND_CAP_PX),
  );
}

export function clampComposerHeight(
  heightPx: number,
  maxHeightPx: number,
): number {
  const max = Math.max(COMPOSER_MIN_HEIGHT_PX, maxHeightPx);
  return Math.min(max, Math.max(COMPOSER_MIN_HEIGHT_PX, Math.round(heightPx)));
}

/**
 * Drag: moving pointer up increases height (sidebar footer is bottom-anchored).
 * newHeight = startHeight + (startY - currentY)
 */
export function heightFromDrag(
  startHeightPx: number,
  startClientY: number,
  currentClientY: number,
  maxHeightPx: number,
): number {
  return clampComposerHeight(
    startHeightPx + (startClientY - currentClientY),
    maxHeightPx,
  );
}

export function resolveComposerHeightPx(input: {
  mode: ComposerSizeMode;
  manualHeightPx: number | null;
  viewportWidthPx: number;
  viewportHeightPx: number;
  panelHeightPx: number;
}): number {
  const max = composerMaxHeightPx(input.panelHeightPx, input.viewportHeightPx);
  if (input.mode === "manual" && input.manualHeightPx != null) {
    return clampComposerHeight(input.manualHeightPx, max);
  }
  if (input.mode === "expanded") {
    return composerExpandedPresetPx(input.viewportHeightPx, max);
  }
  return clampComposerHeight(
    composerDefaultHeightPx(input.viewportWidthPx),
    max,
  );
}

/** Icon / aria: collapse control when not at default mode. */
export function composerShowsCollapseControl(mode: ComposerSizeMode): boolean {
  return mode !== "default";
}
