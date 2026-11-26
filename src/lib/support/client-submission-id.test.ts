import { describe, expect, it, vi } from "vitest";
import {
  createClientSubmissionId,
  isUuidString,
} from "@/lib/support/client-submission-id";

describe("createClientSubmissionId", () => {
  it("returns a UUID when crypto.randomUUID is available", () => {
    const id = createClientSubmissionId();
    expect(isUuidString(id)).toBe(true);
  });

  it("falls back to getRandomValues UUID when randomUUID is missing", () => {
    const original = globalThis.crypto;
    const getRandomValues = vi.fn((arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = (i * 17) & 0xff;
      return arr;
    });
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: { getRandomValues },
    });
    try {
      const id = createClientSubmissionId();
      expect(isUuidString(id)).toBe(true);
      expect(id.startsWith("sub_")).toBe(false);
      expect(getRandomValues).toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: original,
      });
    }
  });

  it("falls back to Math.random UUID when crypto is unavailable", () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: undefined,
    });
    try {
      const id = createClientSubmissionId();
      expect(isUuidString(id)).toBe(true);
      expect(id.startsWith("sub_")).toBe(false);
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: original,
      });
    }
  });
});
