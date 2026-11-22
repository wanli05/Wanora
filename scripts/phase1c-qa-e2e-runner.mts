/**
 * Phase 1C-QA isolated E2E runner.
 *
 * - Starts Testcontainers Postgres (database name `test`)
 * - Refuses shared `wanora`
 * - Migrates, builds, starts Next (:3100) + AI worker (:8181)
 * - Forces AI_PROVIDER=mock; strips OPENAI_API_KEY from child env
 * - Forwards args after `--` to Playwright (e.g. diagnose-save.spec.ts)
 *
 * Usage:
 *   pnpm exec tsx scripts/phase1c-qa-e2e-runner.mts
 *   pnpm exec tsx scripts/phase1c-qa-e2e-runner.mts --bootstrap-only
 *   pnpm exec tsx scripts/phase1c-qa-e2e-runner.mts -- e2e/phase1c/diagnose-save.spec.ts
 *   pnpm test:e2e:phase1c-qa
 */
import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { runMigrations } from "../src/db/migrate";
import {
  assertAiIsolatedDatabaseUrl,
  checkAiIsolatedDatabaseUrl,
} from "../src/lib/ai/testing";
import { resetServerEnvCache } from "../src/lib/env";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACTS = path.join(ROOT, "artifacts", "phase1c-qa");
const APP_PORT = Number(process.env.PHASE1C_QA_APP_PORT ?? "3100");
const WORKER_HEALTH_PORT = Number(
  process.env.PHASE1C_QA_WORKER_HEALTH_PORT ?? "8181",
);
// Use localhost (not 127.0.0.1) so Playwright NEXT_LOCALE cookie (domain=localhost)
// from e2e/ai-helpers.ts applies — otherwise UI stays English and JP selectors hang.
const BASE_URL = `http://localhost:${APP_PORT}`;

const argv = process.argv.slice(2);
const bootstrapOnly = argv.includes("--bootstrap-only");
const dashIdx = argv.indexOf("--");
const playwrightExtraArgs = dashIdx >= 0 ? argv.slice(dashIdx + 1) : [];

function log(msg: string, extra?: Record<string, unknown>) {
  const line = extra ? `${msg} ${JSON.stringify(extra)}` : msg;
  console.log(`[phase1c-qa-runner] ${line}`);
}

async function waitForUrl(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  let lastErr = "";
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
      lastErr = `status ${res.status}`;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastErr}`);
}

function assertPortFree(port: number): Promise<void> {
  // Bind IPv6 `::` when available so we catch Next's default dual-stack listen
  // (`:::port`). Falling back to 127.0.0.1 covers hosts without IPv6.
  return new Promise((resolve, reject) => {
    const server = createServer();
    const fail = (err: NodeJS.ErrnoException) => {
      reject(
        new Error(
          `Port ${port} is not free (${err.code}). ` +
            `Stop the other process or set PHASE1C_QA_*_PORT.`,
        ),
      );
    };
    server.once("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "EAFNOSUPPORT") {
        const v4 = createServer();
        v4.once("error", (e) => fail(e as NodeJS.ErrnoException));
        v4.listen(port, "127.0.0.1", () => {
          v4.close(() => resolve());
        });
        return;
      }
      fail(err as NodeJS.ErrnoException);
    });
    server.listen(port, "::", () => {
      server.close(() => resolve());
    });
  });
}

function childEnv(databaseUrl: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    WANORA_AI_TEST_DB: "1",
    AUTH_SECRET:
      process.env.AUTH_SECRET ?? "phase1c-qa-secret-0123456789abcdef",
    AUTH_URL: BASE_URL,
    PORT: String(APP_PORT),
    AI_ENABLED: "true",
    AI_PROVIDER: "mock",
    AI_LIVE_SMOKE: "false",
    AI_WORKER_HEALTH_PORT: String(WORKER_HEALTH_PORT),
    AI_WORKER_POLL_MS: process.env.AI_WORKER_POLL_MS ?? "400",
    AI_WORKER_BATCH: process.env.AI_WORKER_BATCH ?? "1",
    AI_WORKER_ID: "phase1c-qa-worker",
    AI_RATE_LIMIT_PER_MINUTE: process.env.AI_RATE_LIMIT_PER_MINUTE ?? "200",
    AI_DAILY_TOKEN_BUDGET: process.env.AI_DAILY_TOKEN_BUDGET ?? "500000",
    AI_DAILY_COST_BUDGET_USD: process.env.AI_DAILY_COST_BUDGET_USD ?? "5",
    AI_GLOBAL_DAILY_COST_BUDGET_USD:
      process.env.AI_GLOBAL_DAILY_COST_BUDGET_USD ?? "50",
  };
  delete env.OPENAI_API_KEY;
  return env;
}

/**
 * Resolve how to invoke pnpm under `spawn` without shell when possible.
 * On Windows, Node 20+ cannot `spawn("pnpm")` / bare `.cmd` with `shell:false`
 * (ENOENT / EINVAL). Prefer `node corepack/dist/pnpm.js`; fall back to
 * `pnpm.cmd` + `shell:true` (args here are fixed runner flags, not user input).
 */
function resolvePnpmSpawn(args: string[]): {
  command: string;
  args: string[];
  shell: boolean;
} {
  if (process.platform !== "win32") {
    return { command: "pnpm", args, shell: false };
  }

  const corepackCandidates = [
    path.join(
      "C:\\Program Files\\nodejs",
      "node_modules",
      "corepack",
      "dist",
      "pnpm.js",
    ),
    path.join(
      path.dirname(process.execPath),
      "node_modules",
      "corepack",
      "dist",
      "pnpm.js",
    ),
  ];
  const systemNode = "C:\\Program Files\\nodejs\\node.exe";
  for (const pnpmJs of corepackCandidates) {
    if (!existsSync(pnpmJs)) continue;
    const nodeBin = existsSync(systemNode) ? systemNode : process.execPath;
    return { command: nodeBin, args: [pnpmJs, ...args], shell: false };
  }

  return { command: "pnpm.cmd", args, shell: true };
}

function spawnPnpm(
  pnpmArgs: string[],
  options: SpawnOptions,
): ChildProcess {
  const resolved = resolvePnpmSpawn(pnpmArgs);
  return spawn(resolved.command, resolved.args, {
    ...options,
    shell: resolved.shell,
  });
}

function spawnLogged(
  pnpmArgs: string[],
  env: NodeJS.ProcessEnv,
  label: string,
): ChildProcess {
  const child = spawnPnpm(pnpmArgs, {
    cwd: ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const prefix = `[${label}] `;
  child.stdout?.on("data", (buf: Buffer) => {
    for (const line of buf.toString("utf8").split(/\r?\n/)) {
      if (line) console.log(prefix + line);
    }
  });
  child.stderr?.on("data", (buf: Buffer) => {
    for (const line of buf.toString("utf8").split(/\r?\n/)) {
      if (line) console.error(prefix + line);
    }
  });
  return child;
}

async function stopChild(child: ChildProcess | undefined, label: string) {
  if (!child || child.killed || child.exitCode != null) return;
  log(`stopping ${label}`);
  child.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => child.once("exit", () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 8_000)),
  ]);
  if (child.exitCode == null && !child.killed) {
    child.kill("SIGKILL");
  }
}

function runPlaywright(
  env: NodeJS.ProcessEnv,
  extraArgs: string[],
): Promise<number> {
  return new Promise((resolve) => {
    const args = [
      "exec",
      "playwright",
      "test",
      "-c",
      "playwright.phase1c-qa.config.ts",
      ...extraArgs,
    ];
    log("starting playwright", { args: extraArgs });
    const child = spawnPnpm(args, {
      cwd: ROOT,
      env,
      stdio: "inherit",
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

/**
 * Fail-fast Mock Scheme A gate — avoid 120s Apply timeouts when mock is
 * incompatible (Step 4C). In-process only; does not touch shared DBs.
 */
async function assertMockRefineContractGate(): Promise<void> {
  const { createMockAiProvider, MOCK_REFINE_TEXT_PREFIX } = await import(
    "../src/lib/ai/providers/mock"
  );
  const { buildRefinePrompt } = await import(
    "../src/components/ai-sidebar/refine-prompts"
  );
  const { extractRefinedText } = await import(
    "../src/components/ai-sidebar/extract-refined-text"
  );

  const draft = "phase1c-qa-contract-gate";
  const feature = "self_pr_refine" as const;
  const provider = createMockAiProvider();
  const result = await provider.complete({
    feature,
    messages: [
      {
        role: "user",
        content: buildRefinePrompt({ feature, draftText: draft }),
      },
    ],
  });
  const extracted = extractRefinedText(result.text);
  const expected = `${MOCK_REFINE_TEXT_PREFIX}${draft}`;
  if (extracted !== expected) {
    throw new Error(
      `Mock Scheme A contract gate failed before Playwright ` +
        `(extracted=${JSON.stringify(extracted)}; expected=${JSON.stringify(expected)}; ` +
        `preview=${JSON.stringify(result.text.slice(0, 240))}). ` +
        `Aborting to avoid mass 120s Apply timeouts.`,
    );
  }
  log("mock refine contract gate ok");
}

let container: StartedPostgreSqlContainer | undefined;
let nextProc: ChildProcess | undefined;
let workerProc: ChildProcess | undefined;
let exitCode = 1;

try {
  mkdirSync(ARTIFACTS, { recursive: true });

  await assertPortFree(APP_PORT);
  await assertPortFree(WORKER_HEALTH_PORT);

  log("starting Testcontainers Postgres");
  container = await new PostgreSqlContainer("postgres:17-alpine").start();
  const databaseUrl = container.getConnectionUri();
  assertAiIsolatedDatabaseUrl(databaseUrl);
  const isolation = checkAiIsolatedDatabaseUrl(databaseUrl);
  log(
    `isolated DB ok host=${isolation.ok ? isolation.host : "?"} database=${isolation.ok ? isolation.database : "?"} (${isolation.ok ? isolation.reason : isolation.reason})`,
  );

  process.env.DATABASE_URL = databaseUrl;
  process.env.WANORA_AI_TEST_DB = "1";
  process.env.AI_PROVIDER = "mock";
  process.env.AI_LIVE_SMOKE = "false";
  delete process.env.OPENAI_API_KEY;
  resetServerEnvCache();

  log("running migrations on isolated DB");
  await runMigrations(databaseUrl);

  if (bootstrapOnly) {
    log("bootstrap-only: migrate + isolation ok");
    exitCode = 0;
  } else {
    const env = childEnv(databaseUrl);

    log("building Next app");
    const build = spawnLogged(["build"], env, "build");
    const buildCode: number = await new Promise((resolve) => {
      build.on("exit", (code) => resolve(code ?? 1));
    });
    if (buildCode !== 0) {
      throw new Error(`pnpm build failed with exit ${buildCode}`);
    }

    log(`starting next on :${APP_PORT}`);
    nextProc = spawnLogged(
      ["exec", "next", "start", "--port", String(APP_PORT)],
      env,
      "next",
    );

    log(`starting worker health :${WORKER_HEALTH_PORT}`);
    // Intentionally NOT `pnpm ai:worker` — that uses --env-file=.env.local
    // and would reintroduce shared DATABASE_URL / OpenAI key.
    workerProc = spawnLogged(
      ["exec", "tsx", "scripts/ai-worker.mts"],
      env,
      "worker",
    );

    await waitForUrl(`${BASE_URL}/api/health`, 180_000);
    await waitForUrl(
      `http://localhost:${WORKER_HEALTH_PORT}/healthz`,
      60_000,
    );

    const statusRes = await fetch(`${BASE_URL}/api/ai/status`);
    const statusBody = (await statusRes.json()) as {
      enabled?: boolean;
      provider?: string;
    };
    log(
      `ai/status enabled=${statusBody.enabled} provider=${statusBody.provider}`,
    );
    if (statusBody.provider !== "mock") {
      throw new Error(
        `Expected AI_PROVIDER=mock, got provider=${statusBody.provider}`,
      );
    }
    if (statusBody.enabled !== true) {
      throw new Error(
        `Expected AI enabled for Phase1C QA, got enabled=${statusBody.enabled}`,
      );
    }

    await assertMockRefineContractGate();

    const pwEnv: NodeJS.ProcessEnv = {
      ...env,
      PORT: String(APP_PORT),
      AUTH_URL: BASE_URL,
      BASE_URL,
      PHASE1C_QA_DATABASE_URL: databaseUrl,
      PLAYWRIGHT_HTML_REPORT: path.join(ARTIFACTS, "playwright-report"),
    };
    exitCode = await runPlaywright(pwEnv, playwrightExtraArgs);
  }
} catch (err) {
  console.error("[phase1c-qa-runner] fatal:", err);
  exitCode = 1;
} finally {
  await stopChild(nextProc, "next");
  await stopChild(workerProc, "worker");
  if (container) {
    log("stopping Testcontainers Postgres");
    try {
      await container.stop();
    } catch (err) {
      console.error("[phase1c-qa-runner] container stop failed:", err);
    }
  }
}

process.exit(exitCode);
