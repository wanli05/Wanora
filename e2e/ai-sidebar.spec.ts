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

    await page.reload({ waitUntil: "networkidle" });
    await openAiSidebar(page);

    await expect(
      page.getByTestId("ai-msg-user").filter({ hasText: marker }),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("ai-msg-assistant")
        .filter({ hasText: "【モック応答】ご入力を受け取りました：" }),
    ).toBeVisible();
    await closeAiSidebar(page);
  });

  test("UX: page hint, optional adjuster, suggestion fills only", async ({
    request,
  }) => {
    await expectAiStatus(request, true);
    await page.goto("/profile");
    await expect(page.getByTestId("signed-in-as")).toBeVisible();
    await openAiSidebar(page);
    await page.getByTestId("ai-new-conversation").click();

    await expect(page.getByTestId("ai-context-ref")).toContainText("My Career");
    await expect(page.getByTestId("ai-page-context")).toHaveText("my_career");
    await expect(page.getByTestId("ai-suggestions")).toBeVisible();
    await expect(page.getByTestId("ai-suggest-self_pr")).toBeVisible();

    await page.getByTestId("ai-suggest-self_pr").click();
    await expect(page.getByTestId("ai-composer-input")).toHaveValue(
      /自己PRの改善について相談したいです/,
    );
    await expect(page.getByTestId("ai-job-status")).toHaveCount(0);
    await expect(page.getByTestId("ai-msg-user")).toHaveCount(0);

    await page.getByTestId("ai-context-ref").click();
    await expect(page.getByTestId("ai-context-adjuster")).toBeVisible();
    await expect(page.getByTestId("ai-target-select")).toBeVisible();
    await page.getByTestId("ai-target-select").selectOption("");
    await expect(page.getByTestId("ai-target-context")).toContainText("指定なし");
  });
});
