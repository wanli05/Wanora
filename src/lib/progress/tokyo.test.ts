import { describe, expect, it } from "vitest";
import { endOneHourAfter } from "./tokyo";

describe("endOneHourAfter", () => {
  it("defaults interview length to one hour", () => {
    expect(endOneHourAfter("2026-11-12T05:00:00.000Z")).toBe(
      "2026-11-12T06:00:00.000Z",
    );
  });
});
