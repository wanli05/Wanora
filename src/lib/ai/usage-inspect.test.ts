import { describe, expect, it } from "vitest";
import type { AiJobRow } from "@/lib/data/ai-jobs";
import type { AiUsageEventRow } from "@/lib/data/ai-usage";
import {
  inferProviderCallsFromJob,
  jobEnteredProvider,
} from "@/lib/ai/usage-inspect";

function job(
  patch: Partial<AiJobRow> &
    Pick<AiJobRow, "attempt" | "executionPhase" | "providerOutcome">,
): Pick<
  AiJobRow,
  | "attempt"
  | "executionPhase"
  | "providerOutcome"
  | "errorCode"
  | "provider"
  | "model"
  | "usageEventId"
> {
  return {
    errorCode: null,
    provider: "mock",
    model: "mock-v1",
    usageEventId: "usage-1",
    ...patch,
  };
}

function usage(
  patch: Partial<AiUsageEventRow> &
    Pick<AiUsageEventRow, "status" | "estimatedCostUsd">,
): AiUsageEventRow {
  return {
    id: "usage-1",
    userId: "user-1",
    feature: "self_pr_refine",
    provider: "mock",
    model: "mock-v1",
    promptVersion: null,
    inputTokens: 0,
    outputTokens: 0,
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

describe("jobEnteredProvider / inferProviderCallsFromJob", () => {
  it("treats before_provider claims as zero Provider calls even when attempt>1", () => {
    expect(
      jobEnteredProvider(
        job({
          attempt: 3,
          executionPhase: "before_provider",
          providerOutcome: "not_started",
        }),
      ),
    ).toBe(false);

    const inferred = inferProviderCallsFromJob(
      job({
        attempt: 3,
        executionPhase: "before_provider",
        providerOutcome: "not_started",
      }),
      usage({ status: "reserved", estimatedCostUsd: "0.010000" }),
    );
    expect(inferred.workerClaimAttempts).toBe(3);
    expect(inferred.providerCallsInferred).toBe(0);
    expect(inferred.providerCalls).toHaveLength(0);
  });

  it("counts one Provider call when usage is unknown after entry", () => {
    const inferred = inferProviderCallsFromJob(
      job({
        attempt: 1,
        executionPhase: "after_provider",
        providerOutcome: "uncertain",
        errorCode: "usage_unknown",
      }),
      usage({
        status: "reserved",
        estimatedCostUsd: "0.010000",
        errorCode: null,
      }),
    );
    expect(inferred.workerClaimAttempts).toBe(1);
    expect(inferred.providerCallsInferred).toBe(1);
    expect(inferred.providerCalls[0]?.status).toBe(
      "uncertain_tokens_unknown",
    );
    expect(inferred.providerCalls[0]?.costDisplay?.kind).toBe("reserved");
    expect(inferred.providerCalls[0]?.inputTokens).toBeNull();
  });

  it("counts succeeded settle as one Provider call with tokens", () => {
    const inferred = inferProviderCallsFromJob(
      job({
        attempt: 2,
        executionPhase: "after_provider",
        providerOutcome: "succeeded",
      }),
      usage({
        status: "ok",
        estimatedCostUsd: "0.001200",
        inputTokens: 100,
        outputTokens: 40,
        providerResponseId: "resp_ok",
      }),
    );
    // attempt=2 means one before_provider reclaim + one successful claim —
    // still only one Provider call after entry.
    expect(inferred.workerClaimAttempts).toBe(2);
    expect(inferred.providerCallsInferred).toBe(1);
    expect(inferred.providerCalls[0]).toMatchObject({
      status: "succeeded",
      inputTokens: 100,
      outputTokens: 40,
      providerResponseId: "resp_ok",
    });
  });
});
