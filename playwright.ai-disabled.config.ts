import { defineConfig, devices } from "@playwright/test";

/**
 * Isolated stack for A8-03: AI_ENABLED=false on a dedicated port.
 * No AI worker — entry must stay hidden even when signed in.
 */
const port = Number(process.env.AI_DISABLED_PORT ?? 3101);
const baseURL = `http://localhost:${port}`;
// Ensure helper Origin headers match this isolated stack.
process.env.PORT = String(port);
process.env.AUTH_URL = baseURL;
const authSecret =
  process.env.AUTH_SECRET ?? "e2e-only-secret-0123456789abcdefghij";

const env: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  ),
  PORT: String(port),
  AUTH_SECRET: authSecret,
  AUTH_URL: baseURL,
  AI_ENABLED: "false",
  AI_PROVIDER: "mock",
};

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/ai-sidebar-disabled.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Build if needed (CI usually already has .next from the enabled e2e job).
    command: `pnpm db:migrate && pnpm build && pnpm exec next start --port ${port}`,
    env,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
