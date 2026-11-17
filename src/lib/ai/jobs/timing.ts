/**
 * Worker lease must outlive provider wait + settle slack so a still-running
 * worker is not marked uncertain mid-call (static lease; no heartbeat in B1c).
 */

export const DEFAULT_AI_OPENAI_TIMEOUT_MS = 60_000;
/** DB settle / fencing write headroom after provider returns. */
export const DEFAULT_AI_WORKER_SETTLE_SLACK_MS = 15_000;
/**
 * Default lease: timeout (60s) + slack (15s) + small buffer.
 * claimAiJobs / startAiWorker use this when callers omit leaseMs.
 */
export const DEFAULT_AI_WORKER_LEASE_MS = 90_000;

export type WorkerTimingConfig = {
  leaseMs: number;
  providerTimeoutMs: number;
  settleSlackMs: number;
};

export function requiredLeaseMs(
  providerTimeoutMs: number,
  settleSlackMs: number,
): number {
  return providerTimeoutMs + settleSlackMs;
}

/**
 * Throws when lease cannot cover provider timeout + settle slack.
 * Call at worker process start (and in tests).
 */
export function assertWorkerLeaseCoversProvider(
  config: WorkerTimingConfig,
): void {
  const { leaseMs, providerTimeoutMs, settleSlackMs } = config;
  if (
    !Number.isFinite(leaseMs) ||
    !Number.isFinite(providerTimeoutMs) ||
    !Number.isFinite(settleSlackMs) ||
    leaseMs <= 0 ||
    providerTimeoutMs <= 0 ||
    settleSlackMs < 0
  ) {
    throw new Error(
      `ai_worker_timing_invalid:lease=${leaseMs}:timeout=${providerTimeoutMs}:slack=${settleSlackMs}`,
    );
  }
  const need = requiredLeaseMs(providerTimeoutMs, settleSlackMs);
  if (leaseMs <= need) {
    throw new Error(
      `ai_worker_lease_too_short:leaseMs=${leaseMs}:need>${need}:providerTimeoutMs=${providerTimeoutMs}:settleSlackMs=${settleSlackMs}`,
    );
  }
}

/** Soft upper bound for awaiting in-flight job after abort (shutdown). */
export const DEFAULT_AI_WORKER_SHUTDOWN_WAIT_MS = 120_000;
