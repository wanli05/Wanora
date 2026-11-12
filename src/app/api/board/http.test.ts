import { describe, expect, it } from "vitest";
import { ProgressError } from "@/lib/progress/errors";
import { progressResponse } from "./http";

describe("progressResponse", () => {
  it("maps ProgressError codes to HTTP status", async () => {
    const res = progressResponse(new ProgressError("not_found", "missing"));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ error: "not_found" });
  });

  it("maps Postgres unique violations to conflict instead of throwing", async () => {
    const res = progressResponse({ code: "23505", message: "duplicate key" });
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ error: "conflict" });
  });
});
