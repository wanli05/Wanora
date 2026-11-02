import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Requires DATABASE_URL pointing at a Postgres the tests may write to.
    command: `pnpm db:migrate && pnpm build && pnpm start --port ${port}`,
    env: {
      AUTH_SECRET:
        process.env.AUTH_SECRET ?? "e2e-only-secret-0123456789abcdefghij",
      AUTH_URL: baseURL,
    },
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
