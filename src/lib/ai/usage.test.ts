import { describe, expect, it } from "vitest";
import type { AiUsageEventRow } from "@/lib/data/ai-usage";
import {
  displayAiUsageCost,
  serializeAiUsageMeta,
  tokyoDayBounds,
} from "@/lib/ai/usage";

function row(
  patch: Partial<AiUsageEventRow> &
    Pick<AiUsageEventRow, "status" | "estimatedCostUsd">,
): AiUsageEventRow {
  return {
    id: "u1",
    userId: "user-1",
    feature: "self_pr_refine",
    provider: "mock",
    model: "mock-model",
    promptVersion: null,
    inputTokens: 10,
    outputTokens: 5,
    cachedInputTokens: 0,
    reasoningTokens: 0,
    pricingVersion: "2026-11-17",
    providerResponseId: null,
    latencyMs: null,
    errorCode: null,
    requestId: "req-1",
    conversationId: null,
    createdAt: new Date("2026-11-27T15:00:00.000Z"),
    ...patch,
  };
}

describe("displayAiUsageCost", () => {
  it("keeps settled ok cost as known", () => {
    expect(
      displayAiUsageCost(row({ status: "ok", estimatedCostUsd: "0.001200" })),
    ).toEqual({ kind: "known", estimatedCostUsd: "0.001200" });
  });

  it("marks usage_unknown as unknown — never collapses to free", () => {
    expect(
      displayAiUsageCost(
        row({
          status: "error",
          estimatedCostUsd: "0.010000",
          errorCode: "usage_unknown",
        }),
      ),
    ).toEqual({ kind: "unknown", reason: "usage_unknown" });
  });

  it("shows reserved estimate separately", () => {
    expect(
      displayAiUsageCost(
        row({ status: "reserved", estimatedCostUsd: "0.020000" }),
      ),
    ).toEqual({ kind: "reserved", estimatedCostUsd: "0.020000" });
  });
});

describe("serializeAiUsageMeta", () => {
  it("emits metadata without message bodies", () => {
    const meta = serializeAiUsageMeta(
      row({ status: "ok", estimatedCostUsd: "0.001000" }),
    );
    expect(meta).toMatchObject({
      userId: "user-1",
      feature: "self_pr_refine",
      provider: "mock",
      requestId: "req-1",
      costDisplay: { kind: "known", estimatedCostUsd: "0.001000" },
    });
    expect(meta).not.toHaveProperty("content");
    expect(JSON.stringify(meta)).not.toMatch(/自己PR|prompt|messages/i);
  });
});

describe("tokyoDayBounds", () => {
  it("uses Asia/Tokyo midnight boundaries", () => {
    const { dayStart, dayEndExclusive } = tokyoDayBounds("2026-11-28");
    expect(dayStart.toISOString()).toBe("2026-11-27T15:00:00.000Z");
    expect(dayEndExclusive.toISOString()).toBe("2026-11-28T15:00:00.000Z");
  });

  it("rejects invalid day strings", () => {
    expect(() => tokyoDayBounds("11/28/2026")).toThrow(/invalid Tokyo day/);
  });
});
