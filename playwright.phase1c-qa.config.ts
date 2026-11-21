import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

/**
 * Phase 1C-QA Playwright config.
 *
 * No webServer — `scripts/phase1c-qa-e2e-runner.mts` owns Testcontainers,
 * migrate, Next, and the AI worker. Do not use the default playwright.config.ts
 * for this suite (it targets shared DATABASE_URL / wanora).
 */
const port = Number(process.env.PORT ?? process.env.PHASE1C_QA_APP_PORT ?? 3100);
const baseURL =
  process.env.BASE_URL ?? process.env.AUTH_URL ?? `http://localhost:${port}`;

const artifacts = path.join("artifacts", "phase1c-qa");

export default defineConfig({
  testDir: "./e2e/phase1c",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: [
    ["list"],
    ["json", { outputFile: path.join(artifacts, "playwright-results.json") }],
    ["html", { open: "never", outputFolder: path.join(artifacts, "html-report") }],
  ],
  outputDir: path.join(artifacts, "test-results"),
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
