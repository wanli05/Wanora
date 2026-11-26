import { defineConfig, devices } from "@playwright/test";

/**
 * Layout regression for SlotGrid inside the 480px edit drawer.
 * Serves a Vite harness — no Postgres / Next auth required.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/slot-grid-layout.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://127.0.0.1:4177",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      "pnpm exec vite --config scripts/slot-grid-layout.vite.config.mts",
    url: "http://127.0.0.1:4177",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
