import { describe, expect, it } from "vitest";
import type { AiUsageEventRow } from "@/lib/data/ai-usage";
import {
  AI_USAGE_RECENT_DEFAULT_LIMIT,
  buildRecentAiUsageRow,
  formatRecentAiUsageLine,
  formatRecentAiUsageReport,
  formatRecentCostLabel,
  formatTokyoDateTime,
  selectRecentAiUsageRows,
  tokensForRecentDisplay,
  type RecentAiUsageRow,
} from "@/lib/ai/usage-recent";

function usage(
  patch: Partial<AiUsageEventRow> &
    Pick<AiUsageEventRow, "status" | "estimatedCostUsd">,
): AiUsageEventRow {
  return {
    id: "u1",
    userId: "user-a",
    feature: "self_pr_refine",
    provider: "mock",
    model: "mock-v1",
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
    createdAt: new Date("2026-11-28T15:00:00.000Z"),
    ...patch,
  };
}

function recent(
  patch: Partial<RecentAiUsageRow> &
    Pick<RecentAiUsageRow, "createdAt" | "clientRequestId" | "userId">,
): RecentAiUsageRow {
  return {
    tokyoTime: formatTokyoDateTime(patch.createdAt),
    feature: "self_pr_refine",
    provider: "mock",
    model: "mock-v1",
    jobStatus: "succeeded",
    inputTokens: 10,
    outputTokens: 5,
    costDisplay: { kind: "known", estimatedCostUsd: "0.001000" },
    costLabel: "$0.001000 settled",
    ...patch,
  };
}

describe("formatTokyoDateTime", () => {
  it("formats Asia/Tokyo wall clock with JST label", () => {
    // 2026-11-28T15:00:00Z = 2026-11-29 00:00:00 JST
    expect(formatTokyoDateTime(new Date("2026-11-28T15:00:00.000Z"))).toBe(
      "2026-11-29 00:00:00 JST",
    );
  });
});

describe("cost / token display for --recent", () => {
  it("labels settled, reserved, and unknown distinctly", () => {
    expect(
      formatRecentCostLabel({ kind: "known", estimatedCostUsd: "0.001200" }),
    ).toBe("$0.001200 settled");
    expect(
      formatRecentCostLabel({ kind: "reserved", estimatedCostUsd: "0.020000" }),
    ).toBe("$0.020000 reserved");
    expect(
      formatRecentCostLabel({ kind: "unknown", reason: "usage_unknown" }),
    ).toBe("unknown (usage_unknown)");
  });

  it("hides tokens when cost is unknown", () => {
    expect(
      tokensForRecentDisplay(
        usage({
          status: "error",
          estimatedCostUsd: "0.010000",
          errorCode: "usage_unknown",
          inputTokens: 0,
          outputTokens: 0,
        }),
        { kind: "unknown", reason: "usage_unknown" },
      ),
    ).toEqual({ inputTokens: null, outputTokens: null });
  });

  it("buildRecentAiUsageRow surfaces reserved cost, not free", () => {
    const row = buildRecentAiUsageRow({
      createdAt: new Date("2026-11-28T15:00:00.000Z"),
      userId: "user-a",
      feature: "self_pr_refine",
      provider: "mock",
      model: "mock-v1",
      jobStatus: "failed",
      clientRequestId: "req-unknown",
      usage: usage({
        status: "reserved",
        estimatedCostUsd: "0.012000",
        inputTokens: 120,
        outputTokens: 0,
      }),
    });
    expect(row.costDisplay.kind).toBe("reserved");
    expect(row.costLabel).toBe("$0.012000 reserved");
    expect(row.inputTokens).toBe(120);
  });

  it("buildRecentAiUsageRow marks usage_unknown as unknown cost", () => {
    const row = buildRecentAiUsageRow({
      createdAt: new Date("2026-11-28T15:00:00.000Z"),
      userId: "user-a",
      feature: "job_summary_refine",
      provider: "openai",
      model: "gpt-6.1-terra",
      jobStatus: "failed",
      clientRequestId: "req-unk",
      usage: usage({
        status: "error",
        estimatedCostUsd: "0.010000",
        errorCode: "usage_unknown",
      }),
    });
    expect(row.costDisplay).toEqual({
      kind: "unknown",
      reason: "usage_unknown",
    });
    expect(row.costLabel).toBe("unknown (usage_unknown)");
    expect(row.inputTokens).toBeNull();
    expect(row.outputTokens).toBeNull();
  });
});

describe("selectRecentAiUsageRows", () => {
  const base = [
    recent({
      createdAt: new Date("2026-11-28T10:00:00.000Z"),
      userId: "user-a",
      clientRequestId: "req-old",
      feature: "chat",
    }),
    recent({
      createdAt: new Date("2026-11-28T12:00:00.000Z"),
      userId: "user-b",
      clientRequestId: "req-b",
      feature: "self_pr_refine",
    }),
    recent({
      createdAt: new Date("2026-11-28T11:00:00.000Z"),
      userId: "user-a",
      clientRequestId: "req-mid",
      feature: "job_summary_refine",
    }),
    recent({
      createdAt: new Date("2026-11-28T13:00:00.000Z"),
      userId: "user-a",
      clientRequestId: "req-new",
      feature: "self_pr_refine",
    }),
    recent({
      createdAt: new Date("2026-11-28T09:00:00.000Z"),
      userId: "user-a",
      clientRequestId: "req-older",
    }),
    recent({
      createdAt: new Date("2026-11-28T14:00:00.000Z"),
      userId: "user-a",
      clientRequestId: "req-newest",
    }),
    recent({
      createdAt: new Date("2026-11-28T08:00:00.000Z"),
      userId: "user-a",
      clientRequestId: "req-extra",
    }),
  ];

  it("sorts newest-first and caps at default 5", () => {
    expect(AI_USAGE_RECENT_DEFAULT_LIMIT).toBe(5);
    const selected = selectRecentAiUsageRows(base);
    expect(selected).toHaveLength(5);
    expect(selected.map((r) => r.clientRequestId)).toEqual([
      "req-newest",
      "req-new",
      "req-b",
      "req-mid",
      "req-old",
    ]);
  });

  it("filters by userId then applies limit", () => {
    const selected = selectRecentAiUsageRows(base, {
      userId: "user-a",
      limit: 5,
    });
    expect(selected.every((r) => r.userId === "user-a")).toBe(true);
    expect(selected).toHaveLength(5);
    expect(selected[0]?.clientRequestId).toBe("req-newest");
    expect(selected.map((r) => r.clientRequestId)).not.toContain("req-b");
  });

  it("returns empty list when nothing matches", () => {
    expect(
      selectRecentAiUsageRows(base, { userId: "user-nobody" }),
    ).toEqual([]);
    expect(formatRecentAiUsageReport([])).toBe("(no recent AI requests)");
  });
});

describe("formatRecentAiUsageLine", () => {
  it("emits one metadata line without prompt bodies", () => {
    const line = formatRecentAiUsageLine(
      recent({
        createdAt: new Date("2026-11-28T15:00:00.000Z"),
        userId: "user-a",
        clientRequestId: "req-line-1",
        feature: "self_pr_refine",
        costLabel: "$0.001200 settled",
      }),
    );
    expect(line).toContain("2026-11-29 00:00:00 JST");
    expect(line).toContain("self_pr_refine");
    expect(line).toContain("mock");
    expect(line).toContain("succeeded");
    expect(line).toContain("in=10");
    expect(line).toContain("out=5");
    expect(line).toContain("$0.001200 settled");
    expect(line).toContain("req-line-1");
    expect(line).not.toMatch(/自己PR|prompt|messages|sk-/i);
  });
});
