import { describe, expect, it, vi } from "vitest";
import { createFaultId, logServerFault } from "@/lib/support/fault";

describe("fault helpers", () => {
  it("reuses an existing correlation id", () => {
    expect(createFaultId("job-abc")).toBe("job-abc");
  });

  it("logs scrubbed JSON and returns faultId", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const id = logServerFault({
      errorCode: "career_project_save_failed",
      module: "my_career",
      operation: "save_project",
      err: new Error("secret user@example.com leaked"),
    });
    expect(id.startsWith("flt_")).toBe(true);
    expect(spy).toHaveBeenCalled();
    const payload = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(payload.faultId).toBe(id);
    expect(payload.err.message).not.toContain("user@example.com");
    expect(JSON.stringify(payload)).not.toContain("履歴書");
    spy.mockRestore();
  });
});
