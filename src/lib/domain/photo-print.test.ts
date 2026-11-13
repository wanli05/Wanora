import { describe, expect, it } from "vitest";
import {
  PHOTO_ASPECT_RATIO,
  PHOTO_PRINT_HEIGHT_PX,
  PHOTO_PRINT_WIDTH_PX,
} from "./photo-print";

describe("photo-print", () => {
  it("targets 30×40mm at 300dpi (3:4)", () => {
    expect(PHOTO_PRINT_WIDTH_PX).toBe(354);
    expect(PHOTO_PRINT_HEIGHT_PX).toBe(472);
    expect(PHOTO_ASPECT_RATIO).toBeCloseTo(3 / 4, 5);
  });
});
