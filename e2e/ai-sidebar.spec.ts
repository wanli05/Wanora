import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  apiSignUp,
  closeAiSidebar,
  expectAiStatus,
  newSignedInPage,
  openAiSidebar,
  sendAiMessageAndWaitForMockReply,
} from "./ai-helpers";

test.describe("A8 AI Sidebar (enabled)", () => {
  test.describe.configure({ mode: "serial" });

  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    const bootstrap = await browser.newContext();
    const creds = await apiSignUp(bootstrap.request, { name: "A8 Shared User" });
    await bootstrap.close();
    const signed = await newSignedInPage(browser, creds);
    page = signed.page;
    context = signed.context;
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test("A8-01 opens and closes the global sidebar", async ({ request }) => {
    await expectAiStatus(request, true);
    await page.goto("/");
    await expect(page.getByTestId("ai-sidebar-toggle")).toBeVisible();
    await openAiSidebar(page);
    await closeAiSidebar(page);
    await openAiSidebar(page);
    await expect(page.getByTestId("ai-composer-input")).toBeVisible();
    await closeAiSidebar(page);
  });

  test("A8-02 mock multi-turn chat via Job/Worker", async ({ request }) => {
    await expectAiStatus(request, true);
    await page.goto("/");
    await openAiSidebar(page);

    // Free chat: no Target required (PR #24 UX).
    await expect(page.getByTestId("ai-target-select")).toHaveCount(0);
    await expect(page.getByTestId("ai-context-ref")).toBeVisible();

    await page.getByTestId("ai-new-conversation").click();

    const first = `A8一回目メッセージ ${Date.now()}`;
    await sendAiMessageAndWaitForMockReply(page, first);

    const second = `A8二回目メッセージ ${Date.now()}`;
    await sendAiMessageAndWaitForMockReply(page, second);

    const users = page.getByTestId("ai-msg-user");
    const assistants = page.getByTestId("ai-msg-assistant");
    await expect(users).toHaveCount(2);
    await expect(assistants).toHaveCount(2);
    await expect(users.nth(0)).toContainText(first);
    await expect(users.nth(1)).toContainText(second);
    await expect(assistants.nth(0)).toContainText("【モック応答】");
    await expect(assistants.nth(1)).toContainText("【モック応答】");
    await closeAiSidebar(page);
  });

  test("A8-04 restores conversation messages after refresh", async ({
    request,
  }) => {
    await expectAiStatus(request, true);
    await page.goto("/");
    await openAiSidebar(page);
    await page.getByTestId("ai-new-conversation").click();

    const marker = `A8刷新復元 ${Date.now()}`;
    await sendAiMessageAndWaitForMockReply(page, marker);

    const beforeId = await page
      .getByTestId("ai-sidebar-panel")
      .getAttribute("data-active-conversation-id");
    expect(beforeId).toBeTruthy();
    // General chat must stay unslotted (Q7 isolation).
    await expect(page.getByTestId("ai-sidebar-panel")).toHaveAttribute(
      "data-assist-slot-key",
      "",
    );

    await page.reload({ waitUntil: "networkidle" });
    await openAiSidebar(page);

    // Wait for general restore to finish selecting a conversation (not just panel open).
    await expect(page.getByTestId("ai-sidebar-panel")).toHaveAttribute(
      "data-active-conversation-id",
      beforeId!,
      { timeout: 30_000 },
    );
    await expect(page.getByTestId("ai-sidebar-panel")).toHaveAttribute(
      "data-assist-slot-key",
      "",
    );
    await expect(
      page.getByTestId("ai-msg-user").filter({ hasText: marker }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page
        .getByTestId("ai-msg-assistant")
        .filter({ hasText: "【モック応答】ご入力を受け取りました：" }),
    ).toBeVisible({ timeout: 30_000 });
    // Refresh must not re-arm Assist Apply (no refine session after general restore).
    await expect(page.getByTestId("ai-apply-to-draft")).toHaveCount(0);
    await closeAiSidebar(page);
  });

  test("UX: page hint, no focus adjuster, suggestion fills only", async ({
    request,
  }) => {
    await expectAiStatus(request, true);
    await page.goto("/profile");
    await expect(page.getByTestId("signed-in-as")).toBeVisible();
    await openAiSidebar(page);
    await page.getByTestId("ai-new-conversation").click();

    await expect(page.getByTestId("ai-context-ref")).toContainText("参照：My Career");
    await expect(page.getByTestId("ai-page-context")).toHaveText("my_career");
    await expect(page.getByTestId("ai-context-adjuster")).toHaveCount(0);
    await expect(page.getByTestId("ai-target-select")).toHaveCount(0);
    await expect(page.getByTestId("ai-suggestions")).toBeVisible();
    await expect(page.getByTestId("ai-suggest-self_pr")).toBeVisible();

    await page.getByTestId("ai-suggest-self_pr").click();
    await expect(page.getByTestId("ai-composer-input")).toHaveValue(
      /自己PRの改善について相談したいです/,
    );
    await expect(page.getByTestId("ai-job-status")).toHaveCount(0);
    await expect(page.getByTestId("ai-msg-user")).toHaveCount(0);
    // Suggestion may set send Target, but 参照 stays page-only and adjuster stays gone.
    await expect(page.getByTestId("ai-context-ref")).toContainText("参照：My Career");
    await expect(page.getByTestId("ai-context-adjuster")).toHaveCount(0);

    // Composer expand/collapse is icon-only UI and must not send.
    const draftBefore = await page.getByTestId("ai-composer-input").inputValue();
    const expand = page.getByTestId("ai-composer-expand");
    await expect(expand).toHaveAttribute("aria-label", "入力欄を拡大");
    await expect(expand).not.toContainText("拡大");
    await expand.click();
    await expect(page.getByTestId("ai-composer-input")).toHaveAttribute(
      "data-expanded",
      "true",
    );
    await expect(expand).toHaveAttribute("aria-label", "入力欄を縮小");
    await expect(page.getByTestId("ai-composer-input")).toHaveValue(draftBefore);
    await expect(page.getByTestId("ai-job-status")).toHaveCount(0);
    await expand.click();
    await expect(page.getByTestId("ai-composer-input")).toHaveAttribute(
      "data-expanded",
      "false",
    );
    await expect(page.getByTestId("ai-assist-context")).toHaveCount(0);
  });

  test("UX: native resize disabled; top-edge drag grows height", async ({
    request,
  }) => {
    await expectAiStatus(request, true);
    await page.goto("/");
    await openAiSidebar(page);
    await page.getByTestId("ai-new-conversation").click();

    const composer = page.getByTestId("ai-composer-input");
    await composer.fill("ドラッグで高さを変えるテスト\n".repeat(6));

    const resizeCss = await composer.evaluate((el) =>
      getComputedStyle(el).resize,
    );
    expect(resizeCss).toBe("none");

    const handle = page.getByTestId("ai-composer-resize-handle");
    await expect(handle).toBeVisible();
    const before = await composer.boundingBox();
    expect(before).toBeTruthy();

    const box = await handle.boundingBox();
    expect(box).toBeTruthy();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy - 80, { steps: 8 });
    await page.mouse.up();

    const after = await composer.boundingBox();
    expect(after).toBeTruthy();
    expect(after!.height).toBeGreaterThan(before!.height + 40);
    await expect(composer).toHaveAttribute("data-size-mode", "manual");
    await expect(composer).toHaveValue(/ドラッグで高さを変えるテスト/);
    await expect(page.getByTestId("ai-composer-send")).toBeEnabled();
    await expect(page.getByTestId("ai-job-status")).toHaveCount(0);
  });
});
