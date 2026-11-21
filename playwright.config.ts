import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);
const workerHealthPort = Number(process.env.AI_WORKER_HEALTH_PORT ?? 8081);
const baseURL = `http://localhost:${port}`;

const authSecret =
  process.env.AUTH_SECRET ?? "e2e-only-secret-0123456789abcdefghij";

/** Shared env for Next + AI worker during e2e (mock only; no real provider keys). */
const aiE2eEnv: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  ),
  AUTH_SECRET: authSecret,
  AUTH_URL: baseURL,
  AI_ENABLED: "true",
  AI_PROVIDER: "mock",
  AI_WORKER_HEALTH_PORT: String(workerHealthPort),
  AI_WORKER_POLL_MS: process.env.AI_WORKER_POLL_MS ?? "500",
  AI_WORKER_BATCH: process.env.AI_WORKER_BATCH ?? "1",
};

export default defineConfig({
  testDir: "./e2e",
  // Phase 1C-QA suite requires Testcontainers isolation via
  // scripts/phase1c-qa-e2e-runner.mts + playwright.phase1c-qa.config.ts.
  // Never run it against the shared CI DATABASE_URL (.../wanora).
  testIgnore: ["**/ai-sidebar-disabled.spec.ts", "**/phase1c/**"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // Requires DATABASE_URL pointing at a Postgres the tests may write to.
      command: `pnpm db:migrate && pnpm build && pnpm start --port ${port}`,
      env: aiE2eEnv,
      url: `${baseURL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      // Real mock worker path for Job processing (A8-02).
      command: `pnpm ai:worker`,
      env: {
        ...aiE2eEnv,
        AI_WORKER_ID: process.env.AI_WORKER_ID ?? "e2e-ai-worker",
      },
      url: `http://127.0.0.1:${workerHealthPort}/healthz`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
