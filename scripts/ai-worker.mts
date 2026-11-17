/**
 * Local / Cloud Run entry for the independent AI worker.
 *
 *   pnpm ai:worker
 *
 * Env (via getServerEnv + optional process.env overrides):
 *   DATABASE_URL (required)
 *   AI_OPENAI_TIMEOUT_MS — provider wait (default 60000)
 *   AI_WORKER_LEASE_MS — must be > timeout + settle slack (default 90000)
 *   AI_WORKER_SETTLE_SLACK_MS — settle headroom (default 15000)
 *   AI_WORKER_SHUTDOWN_WAIT_MS — max wait after abort before forced exit
 *   AI_WORKER_HEALTH_PORT — default 8081; set 0 to disable /healthz
 *   AI_WORKER_POLL_MS — idle poll interval (default 1000)
 *   AI_WORKER_BATCH — claim batch size (default 1)
 *   AI_WORKER_ID — optional stable worker id
 */
import { createDb } from "../src/db";
import { getServerEnv } from "../src/lib/env";
import { startAiWorker } from "../src/lib/ai/jobs/worker";
import { assertWorkerLeaseCoversProvider } from "../src/lib/ai/jobs/timing";
import { aiWorkerLog } from "../src/lib/ai/jobs/log";

const env = getServerEnv();

assertWorkerLeaseCoversProvider({
  leaseMs: env.AI_WORKER_LEASE_MS,
  providerTimeoutMs: env.AI_OPENAI_TIMEOUT_MS,
  settleSlackMs: env.AI_WORKER_SETTLE_SLACK_MS,
});

const healthPort = Number(process.env.AI_WORKER_HEALTH_PORT ?? "8081");
const pollIntervalMs = Number(process.env.AI_WORKER_POLL_MS ?? "1000");
const batchSize = Number(process.env.AI_WORKER_BATCH ?? "1");
const shutdownWaitMs = env.AI_WORKER_SHUTDOWN_WAIT_MS;

const { db, pool } = createDb(env.DATABASE_URL);

const handle = startAiWorker({
  db,
  workerId: process.env.AI_WORKER_ID,
  healthPort: Number.isFinite(healthPort) ? healthPort : 8081,
  pollIntervalMs: Number.isFinite(pollIntervalMs) ? pollIntervalMs : 1_000,
  batchSize: Number.isFinite(batchSize) && batchSize > 0 ? batchSize : 1,
  leaseMs: env.AI_WORKER_LEASE_MS,
  providerTimeoutMs: env.AI_OPENAI_TIMEOUT_MS,
  settleSlackMs: env.AI_WORKER_SETTLE_SLACK_MS,
  log: aiWorkerLog,
});

let shuttingDown = false;

const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  aiWorkerLog("received stop signal", { signal, shutdownWaitMs });

  // Abort in-flight provider call first; then wait for the loop (bounded).
  const stopPromise = handle.stop();
  const doneOrTimeout = Promise.race([
    handle.done.then(() => "done" as const),
    new Promise<"timeout">((resolve) => {
      setTimeout(() => resolve("timeout"), shutdownWaitMs);
    }),
  ]);

  await stopPromise;
  const outcome = await doneOrTimeout;
  if (outcome === "timeout") {
    aiWorkerLog("shutdown wait timed out; closing db and exiting", {
      workerId: handle.workerId,
      shutdownWaitMs,
    });
  } else {
    aiWorkerLog("worker loop exited", { workerId: handle.workerId });
  }

  // Close pool after the worker loop has stopped (or timed out).
  try {
    await pool.end();
  } catch (err) {
    aiWorkerLog("pool end error", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  process.exit(outcome === "timeout" ? 1 : 0);
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

await handle.done;
// Normal exit (maxJobs / stop without signal): close pool.
try {
  await pool.end();
} catch {
  // ignore
}
