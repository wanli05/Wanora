"use client";

import { useEffect, useRef } from "react";
import { getJob, writePendingJob, type PendingJobState } from "./ai-api";
import { isJobTerminal } from "./job-status-label";
import type { AiJobDto } from "@/lib/ai/jobs";

const POLL_MS = 1_500;

/**
 * Poll GET /api/ai/jobs/:id until terminal. No SSE in A7 — polling is the path.
 * Authority remains Job API + Messages API (caller refreshes messages on success).
 */
export function useJobPolling(
  pending: PendingJobState | null,
  onUpdate: (job: AiJobDto) => void,
  onTerminal: (job: AiJobDto) => void,
) {
  const onUpdateRef = useRef(onUpdate);
  const onTerminalRef = useRef(onTerminal);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onTerminalRef.current = onTerminal;
  }, [onUpdate, onTerminal]);

  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      const result = await getJob(pending.jobId);
      if (cancelled) return;
      if ("notFound" in result && result.notFound) {
        writePendingJob(null);
        return;
      }
      if ("error" in result && result.error) {
        timer = setTimeout(tick, POLL_MS);
        return;
      }
      if (!("job" in result) || !result.job) {
        timer = setTimeout(tick, POLL_MS);
        return;
      }
      const job = result.job;
      onUpdateRef.current(job);
      if (isJobTerminal(job.status)) {
        writePendingJob(null);
        onTerminalRef.current(job);
        return;
      }
      timer = setTimeout(tick, POLL_MS);
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pending]);
}
