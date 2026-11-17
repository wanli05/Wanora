import { describe, expect, it } from "vitest";
import {
  assertWorkerLeaseCoversProvider,
  DEFAULT_AI_OPENAI_TIMEOUT_MS,
  DEFAULT_AI_WORKER_LEASE_MS,
  DEFAULT_AI_WORKER_SETTLE_SLACK_MS,
  requiredLeaseMs,
} from "@/lib/ai/jobs/timing";

describe("assertWorkerLeaseCoversProvider", () => {
  it("accepts default lease > timeout + slack", () => {
    expect(() =>
      assertWorkerLeaseCoversProvider({
        leaseMs: DEFAULT_AI_WORKER_LEASE_MS,
        providerTimeoutMs: DEFAULT_AI_OPENAI_TIMEOUT_MS,
        settleSlackMs: DEFAULT_AI_WORKER_SETTLE_SLACK_MS,
      }),
    ).not.toThrow();
    expect(DEFAULT_AI_WORKER_LEASE_MS).toBeGreaterThan(
      requiredLeaseMs(
        DEFAULT_AI_OPENAI_TIMEOUT_MS,
        DEFAULT_AI_WORKER_SETTLE_SLACK_MS,
      ),
    );
  });

  it("rejects lease that only equals timeout + slack", () => {
    expect(() =>
      assertWorkerLeaseCoversProvider({
        leaseMs: 75_000,
        providerTimeoutMs: 60_000,
        settleSlackMs: 15_000,
      }),
    ).toThrow(/ai_worker_lease_too_short/);
  });

  it("rejects the historical 30s lease vs 60s provider timeout", () => {
    expect(() =>
      assertWorkerLeaseCoversProvider({
        leaseMs: 30_000,
        providerTimeoutMs: 60_000,
        settleSlackMs: 15_000,
      }),
    ).toThrow(/ai_worker_lease_too_short/);
  });

  it("rejects non-finite values", () => {
    expect(() =>
      assertWorkerLeaseCoversProvider({
        leaseMs: Number.NaN,
        providerTimeoutMs: 60_000,
        settleSlackMs: 0,
      }),
    ).toThrow(/ai_worker_timing_invalid/);
  });
});
