/**
 * QA-23～32 exception / safety.
 * Step 3B:
 * - QA-24: single-continue route gate (no double route.continue)
 * - QA-26: enqueue 503 ai_unavailable (less status-intercept noise)
 * - QA-29: lastRefineAssistant() for multi-bubble
 * Step 4C / QA-25:
 * - Strengthened offline path rewritten from Step 3D report contract
 *   (original Step 3D safety.spec source was not recoverable verbatim).
 * - abort → error; draft retained; send re-enabled; unroute → single resend
 */
import { expect, test } from "@playwright/test";
import {
  closeSidebarIfOpen,
  countNonMockUsage,
  countOpenAiJobs,
  databaseUrl,
  expectAiStatusMock,
  lastRefineAssistant,
  newPhase1cSignedInPage,
  openAiSidebar,
  openProfileCareerEditor,
  sendRefineAndWaitApply,
  apiSignUp,
  newPhase1cSignedInPage as signedIn,
} from "./helpers";
import { apiSignIn, localeCookie } from "../ai-helpers";

test.describe("QA-23～32 safety", () => {
  test("QA-23: enqueue HTTP 500 shows ai-sidebar-error", async ({
    browser,
  }) => {
    const { page, context } = await newPhase1cSignedInPage(browser, {
      name: "Safe QA23",
    });
    await openAiSidebar(page);
    await page.getByTestId("ai-new-conversation").click();

    await page.route("**/api/ai/jobs", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "internal", message: "injected" }),
        });
        return;
      }
      await route.continue();
    });

    await page.getByTestId("ai-composer-input").fill("失敗注入【QA23】");
    await page.getByTestId("ai-composer-send").click();
    await expect(page.getByTestId("ai-sidebar-error")).toBeVisible({
      timeout: 15_000,
    });

    await page.unroute("**/api/ai/jobs");
    await closeSidebarIfOpen(page);
    await context.close();
  });

  test("QA-24: stalled job poll → cancel path (single continue)", async ({
    browser,
  }) => {
    const { page, context } = await newPhase1cSignedInPage(browser, {
      name: "Safe QA24",
    });
    const panel = await openProfileCareerEditor(page);
    await panel.getByTestId("mc-self-pr-input").fill("停滞取消【QA24】");
    await panel.getByTestId("ai-refine-selfPr_ja").click();

    let releasePoll: (() => void) | undefined;
    const holdPoll = new Promise<void>((r) => {
      releasePoll = r;
    });
    let holding = true;
    const continued = new WeakSet<object>();

    await page.route("**/api/ai/jobs/**", async (route) => {
      const req = route.request();
      if (req.method() !== "GET") {
        await route.continue();
        return;
      }
      if (holding) {
        await holdPoll;
      }
      if (continued.has(route)) {
        // Step 3B F11: never double-continue the same route.
        return;
      }
      continued.add(route);
      try {
        await route.continue();
      } catch {
        /* already handled / aborted */
      }
    });

    await page.getByTestId("ai-composer-send").click();
    await expect(page.getByTestId("ai-job-status")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("ai-job-cancel")).toBeVisible();
    holding = false;
    releasePoll?.();
    await page.getByTestId("ai-job-cancel").click();

    await page.unroute("**/api/ai/jobs/**");
    await closeSidebarIfOpen(page);
    await context.close();
  });

  test("QA-25: offline enqueue shows error, restores draft, allows single resend", async ({
    browser,
  }) => {
    /**
     * Source: Step 3D report contract (docs/ai-phase1c-qa-step3d-report.md §2).
     * Step 3D `safety.spec.ts` verbatim was not recoverable — this is a
     * labeled rewrite. Diff vs pre-3D weak assert: also checks draft keep,
     * send re-enabled, network restore resend, and probe.count === 1.
     * Product fix already on main (#42); expect PASS.
     */
    const draftText = "オフライン【QA25】";
    const { page, context } = await newPhase1cSignedInPage(browser, {
      name: "Safe QA25",
    });
    await openAiSidebar(page);
    await page.getByTestId("ai-new-conversation").click();

    await page.route("**/api/ai/jobs", async (route) => {
      if (route.request().method() === "POST") {
        await route.abort("connectionfailed");
        return;
      }
      await route.continue();
    });

    await page.getByTestId("ai-composer-input").fill(draftText);
    await page.getByTestId("ai-composer-send").click();

    await expect(page.getByTestId("ai-sidebar-error")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("ai-composer-input")).toHaveValue(draftText);
    await expect(page.getByTestId("ai-composer-send")).toBeEnabled();

    await page.unroute("**/api/ai/jobs");

    const probe = { count: 0 };
    await page.route("**/api/ai/jobs", async (route) => {
      if (route.request().method() === "POST") {
        probe.count += 1;
      }
      await route.continue();
    });

    await page.getByTestId("ai-composer-send").click();
    await expect(page.getByTestId("ai-msg-assistant").last()).toBeVisible({
      timeout: 90_000,
    });
    expect(probe.count).toBe(1);

    await page.unroute("**/api/ai/jobs");
    await closeSidebarIfOpen(page);
    await context.close();
  });

  test("QA-26: AI unavailable via enqueue 503 (not status intercept)", async ({
    browser,
  }) => {
    const { page, context } = await newPhase1cSignedInPage(browser, {
      name: "Safe QA26",
    });
    await openAiSidebar(page);
    await page.getByTestId("ai-new-conversation").click();

    await page.route("**/api/ai/jobs", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: "ai_unavailable",
            message: "AI disabled for test",
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.getByTestId("ai-composer-input").fill("無効化【QA26】");
    await page.getByTestId("ai-composer-send").click();
    await expect(page.getByTestId("ai-sidebar-error")).toBeVisible({
      timeout: 20_000,
    });

    await page.unroute("**/api/ai/jobs");
    await closeSidebarIfOpen(page);
    await context.close();
  });

  test("QA-27: empty refine body still yields【修正案】+ Apply", async ({
    browser,
  }) => {
    const { page, context } = await newPhase1cSignedInPage(browser, {
      name: "Safe QA27",
    });
    const panel = await openProfileCareerEditor(page);
    await panel.getByTestId("mc-self-pr-input").fill("");
    await panel.getByTestId("ai-refine-selfPr_ja").click();
    await sendRefineAndWaitApply(page);
    await expect(lastRefineAssistant(page)).toContainText("【修正案】");
    await expect(page.getByTestId("ai-apply-to-draft")).toBeVisible();
    await closeSidebarIfOpen(page);
    await context.close();
  });

  test("QA-28: long text refine (>4k)", async ({ browser }) => {
    const { page, context } = await newPhase1cSignedInPage(browser, {
      name: "Safe QA28",
    });
    const panel = await openProfileCareerEditor(page);
    const long = `長文【QA28】${"あ".repeat(4000)}`;
    await panel.getByTestId("mc-self-pr-input").fill(long);
    await panel.getByTestId("ai-refine-selfPr_ja").click();
    await sendRefineAndWaitApply(page);
    await expect(lastRefineAssistant(page)).toContainText("【修正案】");
    await closeSidebarIfOpen(page);
    await context.close();
  });

  test("QA-29: double submit uses lastRefineAssistant (no strict mode)", async ({
    browser,
  }) => {
    const { page, context } = await newPhase1cSignedInPage(browser, {
      name: "Safe QA29",
    });
    const panel = await openProfileCareerEditor(page);
    await panel.getByTestId("mc-self-pr-input").fill("二重送信【QA29】");
    await panel.getByTestId("ai-refine-selfPr_ja").click();
    await sendRefineAndWaitApply(page);
    // Second send in same session — composer is cleared after enqueue; refill first
    // or send stays disabled and Playwright waits until test timeout.
    const priorAssistants = await page.getByTestId("ai-msg-assistant").count();
    await page.getByTestId("ai-composer-input").fill("二重送信【QA29】再送");
    await page.getByTestId("ai-composer-send").click();
    await expect(page.getByTestId("ai-msg-assistant")).toHaveCount(
      priorAssistants + 1,
      { timeout: 90_000 },
    );
    await expect(lastRefineAssistant(page)).toBeVisible();
    const count = await page
      .getByTestId("ai-msg-assistant")
      .filter({ hasText: "【修正案】" })
      .count();
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(3);
    await closeSidebarIfOpen(page);
    await context.close();
  });

  test("QA-30: cross-user job access denied", async ({ browser }) => {
    const a = await newPhase1cSignedInPage(browser, { name: "Safe QA30A" });
    await openAiSidebar(a.page);
    await a.page.getByTestId("ai-new-conversation").click();
    await a.page.getByTestId("ai-composer-input").fill("跨用户【QA30】");
    await a.page.getByTestId("ai-composer-send").click();
    await expect(a.page.getByTestId("ai-msg-assistant").last()).toBeVisible({
      timeout: 90_000,
    });

    // Capture a job id from network if possible; otherwise probe list endpoint.
    const jobsRes = await a.context.request.get("/api/ai/jobs?limit=5");
    let jobId: string | null = null;
    if (jobsRes.ok()) {
      const body = (await jobsRes.json()) as {
        jobs?: Array<{ id: string }>;
      };
      jobId = body.jobs?.[0]?.id ?? null;
    }
    await a.context.close();

    const b = await newPhase1cSignedInPage(browser, { name: "Safe QA30B" });
    if (jobId) {
      const res = await b.context.request.get(`/api/ai/jobs/${jobId}`);
      expect([401, 403, 404]).toContain(res.status());
    } else {
      // Fallback: B cannot list A's conversations via forged id space.
      const res = await b.context.request.get(
        "/api/ai/jobs/00000000-0000-4000-8000-000000000001",
      );
      expect([401, 403, 404]).toContain(res.status());
    }
    await b.context.close();
  });

  test("QA-31: openaiCalls stay 0 (usage/jobs audit)", async ({ browser }) => {
    const { page, context, email } = await newPhase1cSignedInPage(browser, {
      name: "Safe QA31",
    });
    await expectAiStatusMock(page.request);
    await openAiSidebar(page);
    await page.getByTestId("ai-new-conversation").click();
    await page.getByTestId("ai-composer-input").fill("監査【QA31】");
    await page.getByTestId("ai-composer-send").click();
    await expect(page.getByTestId("ai-msg-assistant").last()).toBeVisible({
      timeout: 90_000,
    });

    expect(await countNonMockUsage(email)).toBe(0);
    expect(await countOpenAiJobs()).toBe(0);
    await closeSidebarIfOpen(page);
    await context.close();
  });

  test("QA-32: DB isolation (non-wanora URL)", async () => {
    const url = databaseUrl();
    expect(url).not.toMatch(/\/wanora(\?|$)/i);
    expect(url).toMatch(/localhost|127\.0\.0\.1/);
  });
});

// Keep apiSignUp/apiSignIn imports available for future cross-user variants.
void apiSignUp;
void apiSignIn;
void localeCookie;
void signedIn;
