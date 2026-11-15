/**
 * Local / Cloud Run entry for the independent AI worker.
 *
 *   pnpm ai:worker
 *
 * Env:
 *   DATABASE_URL (required via getServerEnv)
 *   AI_WORKER_HEALTH_PORT — default 8081; set 0 to disable /healthz
 *   AI_WORKER_POLL_MS — idle poll interval (default 1000)
 *   AI_WORKER_BATCH — claim batch size (default 1)
 *   AI_WORKER_ID — optional stable worker id
 */
import { getDb } from "../src/db";
import { getServerEnv } from "../src/lib/env";
import { startAiWorker } from "../src/lib/ai/jobs/worker";

// Ensure env validates early (DATABASE_URL, AI_*, AUTH_*).
getServerEnv();

const healthPort = Number(process.env.AI_WORKER_HEALTH_PORT ?? "8081");
const pollIntervalMs = Number(process.env.AI_WORKER_POLL_MS ?? "1000");
const batchSize = Number(process.env.AI_WORKER_BATCH ?? "1");

const handle = startAiWorker({
  db: getDb(),
  workerId: process.env.AI_WORKER_ID,
  healthPort: Number.isFinite(healthPort) ? healthPort : 8081,
  pollIntervalMs: Number.isFinite(pollIntervalMs) ? pollIntervalMs : 1_000,
  batchSize: Number.isFinite(batchSize) && batchSize > 0 ? batchSize : 1,
});

const shutdown = async (signal: string) => {
  console.log(`[ai-worker] received ${signal}, stopping…`);
  await handle.stop();
  await handle.done;
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

await handle.done;
