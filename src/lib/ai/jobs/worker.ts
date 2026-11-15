import { createServer, type Server } from "node:http";
import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { claimAiJobs } from "@/lib/data/ai-jobs";
import { executeAiJob } from "@/lib/ai/jobs/execute";
import { runAiJobMaintenance } from "@/lib/ai/jobs/recover";
import type { AiProvider } from "@/lib/ai/types";

export type AiWorkerOptions = {
  db: Db;
  workerId?: string;
  /** Jobs claimed per poll. */
  batchSize?: number;
  leaseMs?: number;
  /** Idle sleep between polls (ms). */
  pollIntervalMs?: number;
  /** Health HTTP port; 0 disables. */
  healthPort?: number;
  provider?: AiProvider;
  /** Stop after processing this many jobs (tests). */
  maxJobs?: number;
  /** Invoked after each poll cycle (tests). */
  onCycle?: (claimed: number) => void;
  log?: (msg: string, extra?: Record<string, unknown>) => void;
};

export type AiWorkerHandle = {
  workerId: string;
  /** Resolves when the loop exits. */
  done: Promise<void>;
  stop: () => Promise<void>;
};

function defaultLog(msg: string, extra?: Record<string, unknown>) {
  if (extra) {
    console.log(`[ai-worker] ${msg}`, extra);
  } else {
    console.log(`[ai-worker] ${msg}`);
  }
}

/**
 * Long-running mock AI worker: claim → execute (provider outside TX) → repeat.
 * Supports SIGTERM-friendly stop and optional /healthz.
 */
export function startAiWorker(options: AiWorkerOptions): AiWorkerHandle {
  const workerId =
    options.workerId ??
    `worker-${hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`;
  const batchSize = options.batchSize ?? 1;
  const leaseMs = options.leaseMs ?? 30_000;
  const pollIntervalMs = options.pollIntervalMs ?? 1_000;
  const log = options.log ?? defaultLog;
  let stopping = false;
  let wake: (() => void) | null = null;
  let processed = 0;
  let server: Server | null = null;
  let abort: AbortController | null = null;

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      const t = setTimeout(resolve, ms);
      wake = () => {
        clearTimeout(t);
        resolve();
      };
    });

  const stop = async () => {
    stopping = true;
    abort?.abort();
    wake?.();
    if (server) {
      await new Promise<void>((resolve) => {
        server!.close(() => resolve());
      });
      server = null;
    }
  };

  if (options.healthPort && options.healthPort > 0) {
    server = createServer(async (req, res) => {
      if (req.url === "/healthz" || req.url === "/healthz/") {
        try {
          await options.db.execute(sql`select 1`);
          res.writeHead(200, { "content-type": "application/json" });
          res.end(
            JSON.stringify({
              ok: true,
              workerId,
              stopping,
            }),
          );
        } catch (err) {
          res.writeHead(503, { "content-type": "application/json" });
          res.end(
            JSON.stringify({
              ok: false,
              error: err instanceof Error ? err.message : "db_error",
            }),
          );
        }
        return;
      }
      res.writeHead(404);
      res.end();
    });
    server.listen(options.healthPort, "127.0.0.1");
    log("health listening", { port: options.healthPort, workerId });
  }

  const done = (async () => {
    log("started", { workerId });
    while (!stopping) {
      if (options.maxJobs !== undefined && processed >= options.maxJobs) {
        break;
      }

      abort = new AbortController();
      let claimed = 0;
      try {
        // Lease recovery / uncertain reconcile before claiming work.
        await runAiJobMaintenance(options.db);

        const jobs = await claimAiJobs(options.db, {
          workerId,
          limit: batchSize,
          leaseMs,
        });
        claimed = jobs.length;
        for (const job of jobs) {
          if (stopping) break;
          if (options.maxJobs !== undefined && processed >= options.maxJobs) {
            break;
          }
          const result = await executeAiJob(options.db, {
            job,
            workerId,
            provider: options.provider,
            signal: abort.signal,
          });
          processed += 1;
          log("job finished", {
            jobId: job.id,
            ok: result.ok,
            reason: result.ok ? undefined : result.reason,
          });
        }
      } catch (err) {
        log("cycle error", {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      options.onCycle?.(claimed);

      if (stopping) break;
      if (options.maxJobs !== undefined && processed >= options.maxJobs) {
        break;
      }
      if (claimed === 0) {
        await sleep(pollIntervalMs);
      }
    }
    log("stopped", { workerId, processed });
  })();

  return { workerId, done, stop };
}

/** Process at most `limit` claimed jobs then return (CI / tests). */
export async function runAiWorkerOnce(
  db: Db,
  options?: {
    workerId?: string;
    limit?: number;
    leaseMs?: number;
    provider?: AiProvider;
  },
) {
  const workerId = options?.workerId ?? `once-${randomUUID().slice(0, 8)}`;
  const jobs = await claimAiJobs(db, {
    workerId,
    limit: options?.limit ?? 1,
    leaseMs: options?.leaseMs,
  });
  const results = [];
  for (const job of jobs) {
    results.push(
      await executeAiJob(db, {
        job,
        workerId,
        provider: options?.provider,
      }),
    );
  }
  return { workerId, results };
}

/**
 * Keep claiming until the queue is empty or `maxCycles` is hit.
 * Needed in shared-DB integration suites where earlier tests leave queued rows.
 */
export async function drainAiWorker(
  db: Db,
  options?: {
    workerIdPrefix?: string;
    limit?: number;
    leaseMs?: number;
    provider?: AiProvider;
    maxCycles?: number;
  },
) {
  const maxCycles = options?.maxCycles ?? 50;
  const all = [];
  for (let i = 0; i < maxCycles; i++) {
    const batch = await runAiWorkerOnce(db, {
      workerId: `${options?.workerIdPrefix ?? "drain"}-${i}`,
      limit: options?.limit ?? 5,
      leaseMs: options?.leaseMs,
      provider: options?.provider,
    });
    if (batch.results.length === 0) break;
    all.push(...batch.results);
  }
  return all;
}
