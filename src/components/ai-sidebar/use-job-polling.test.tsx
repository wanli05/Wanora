import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getJob: vi.fn(),
  writePendingJob: vi.fn(),
}));

vi.mock("./ai-api", () => ({
  getJob: api.getJob,
  writePendingJob: api.writePendingJob,
}));

import { useJobPolling } from "./use-job-polling";

describe("useJobPolling", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.getJob.mockReset();
    api.writePendingJob.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stops polling and calls onTimeout when maxPollMs elapses", async () => {
    api.getJob.mockResolvedValue({
      job: {
        id: "job-1",
        conversationId: "c1",
        clientRequestId: "r1",
        feature: "chat",
        status: "queued",
        attempt: 0,
        maxAttempts: 3,
        executionPhase: "queued",
        providerOutcome: "not_started",
        errorCode: null,
        errorMessage: null,
        userMessageId: null,
        resultMessageId: null,
        usageEventId: null,
        provider: null,
        model: null,
        fencingToken: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        startedAt: null,
        finishedAt: null,
        cancelRequestedAt: null,
      },
    });

    const onUpdate = vi.fn();
    const onTerminal = vi.fn();
    const onTimeout = vi.fn();

    renderHook(() =>
      useJobPolling(
        { jobId: "job-1", conversationId: "c1", clientRequestId: "r1" },
        onUpdate,
        onTerminal,
        onTimeout,
        100,
      ),
    );

    await waitFor(() => expect(api.getJob).toHaveBeenCalled());
    // Next poll is scheduled at JOB_POLL_MS; by then maxPollMs has elapsed.
    await vi.advanceTimersByTimeAsync(1_600);
    await waitFor(() => expect(onTimeout).toHaveBeenCalledTimes(1));
    expect(api.writePendingJob).toHaveBeenCalledWith(null);
    expect(onTerminal).not.toHaveBeenCalled();
  });

  it("calls onTerminal and clears pending when job succeeds", async () => {
    api.getJob.mockResolvedValue({
      job: {
        id: "job-2",
        conversationId: "c1",
        clientRequestId: "r2",
        feature: "chat",
        status: "succeeded",
        attempt: 1,
        maxAttempts: 3,
        executionPhase: "after_provider",
        providerOutcome: "succeeded",
        errorCode: null,
        errorMessage: null,
        userMessageId: null,
        resultMessageId: "m1",
        usageEventId: null,
        provider: "mock",
        model: "mock",
        fencingToken: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        cancelRequestedAt: null,
      },
    });

    const onUpdate = vi.fn();
    const onTerminal = vi.fn();
    const onTimeout = vi.fn();

    renderHook(() =>
      useJobPolling(
        { jobId: "job-2", conversationId: "c1", clientRequestId: "r2" },
        onUpdate,
        onTerminal,
        onTimeout,
        90_000,
      ),
    );

    await waitFor(() => expect(onTerminal).toHaveBeenCalledTimes(1));
    expect(api.writePendingJob).toHaveBeenCalledWith(null);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
