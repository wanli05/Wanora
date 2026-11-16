"use client";

import { useEffect, useRef } from "react";
import { getJob, writePendingJob, type PendingJobState } from "./ai-api";
import { isJobTerminal } from "./job-status-label";
import type { AiJobDto } from "@/lib/ai/jobs";

export const JOB_POLL_MS = 1_500;
/** Stop client polling if the job never reaches a terminal status (e.g. worker down). */
export const JOB_POLL_MAX_MS = 90_000;

/**
 * Poll GET /api/ai/jobs/:id until terminal. No SSE in A7 — polling is the path.
 * Authority remains Job API + Messages API (caller refreshes messages on success).
 *
 * If the job stays non-terminal longer than `maxPollMs`, clear session pending and
 * call `onTimeout` so the UI does not spin forever when the worker is offline.
 */
export function useJobPolling(
  pending: PendingJobState | null,
  onUpdate: (job: AiJobDto) => void,
  onTerminal: (job: AiJobDto) => void,
  onTimeout?: () => void,
  maxPollMs: number = JOB_POLL_MAX_MS,
) {
  const onUpdateRef = useRef(onUpdate);
  const onTerminalRef = useRef(onTerminal);
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onTerminalRef.current = onTerminal;
    onTimeoutRef.current = onTimeout;
  }, [onUpdate, onTerminal, onTimeout]);

  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();

    const tick = async () => {
      if (Date.now() - startedAt >= maxPollMs) {
        writePendingJob(null);
        onTimeoutRef.current?.();
        return;
      }
      const result = await getJob(pending.jobId);
      if (cancelled) return;
      if ("notFound" in result && result.notFound) {
        writePendingJob(null);
        return;
      }
      if ("error" in result && result.error) {
        timer = setTimeout(tick, JOB_POLL_MS);
        return;
      }
      if (!("job" in result) || !result.job) {
        timer = setTimeout(tick, JOB_POLL_MS);
        return;
      }
      const job = result.job;
      onUpdateRef.current(job);
      if (isJobTerminal(job.status)) {
        writePendingJob(null);
        onTerminalRef.current(job);
        return;
      }
      timer = setTimeout(tick, JOB_POLL_MS);
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pending, maxPollMs]);
}
