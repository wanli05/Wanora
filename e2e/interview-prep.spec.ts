import { expect, test } from "@playwright/test";
import { apiSignUp, newSignedInPage } from "./ai-helpers";

test("board 面接準備 opens prep page with mock questions when 面接未定", async ({
  browser,
  request,
}) => {
  const creds = await apiSignUp(request, { name: "面接 準備" });
  const { page, context } = await newSignedInPage(browser, creds);

  // Board lives under /progress after left-rail shell.
  await page
    .getByTestId("app-sidebar")
    .getByRole("link", { name: /応募進捗|Applications/ })
    .click();
  await expect(page).toHaveURL("/progress");
  await expect(page.getByRole("heading", { name: "応募進捗" })).toBeVisible();

  await page.getByRole("button", { name: "応募を追加" }).first().click();
  await page.getByLabel("会社").fill("準備テスト株式会社");
  await page.getByLabel("職種").fill("バックエンドエンジニア");
  await page.getByRole("button", { name: "応募を保存" }).click();
  // Company also appears in task-checklist; scope to the board card.
  const card = page.getByTestId(/^card-/).first();
  await expect(card).toBeVisible();
  await expect(card.getByText("準備テスト株式会社")).toBeVisible();
  await card.getByRole("button", { name: "面接準備" }).click();

  await expect(page).toHaveURL(/\/applications\/[^/]+\/interview-prep$/);
  await expect(page.getByTestId("interview-prep-page")).toBeVisible();
  await expect(page.getByTestId("prep-company")).toHaveText("準備テスト株式会社");
  await expect(page.getByTestId("prep-schedule-status")).toContainText("面接未定");
  await expect(page.getByTestId("prep-demo-notice")).toBeVisible();
  await expect(page.getByTestId("prep-questions")).toBeVisible();

  const jobCalls: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/ai/jobs")) jobCalls.push(req.url());
  });

  const first = page.getByTestId("prep-question-common-motivation");
  await expect(first).toBeVisible();
  await first.getByRole("button", { name: "詳細を開く" }).click();
  await expect(
    page.getByTestId("prep-question-details-common-motivation"),
  ).toContainText("質問の意図");

  await page.getByTestId("prep-generate-common-motivation").click();
  await expect(first).toHaveAttribute("data-answer-state", "ready");
  await expect(page.getByTestId("prep-sample-common-motivation")).toBeVisible();

  await page.getByTestId("prep-edit-common-motivation").click();
  await expect(page.getByTestId("prep-editor-common-motivation")).toContainText(
    "デモ：入力内容は保存されません",
  );
  await page.getByTestId("prep-editor-input-common-motivation").fill(
    "E2Eで編集した回答",
  );
  await page.getByTestId("prep-editor-finish-common-motivation").click();
  await expect(page.getByTestId("prep-draft-common-motivation")).toContainText(
    "E2Eで編集した回答",
  );
  await expect(page.getByText("保存しました")).toHaveCount(0);

  await page.getByTestId("prep-generate-common-self-pr").click();
  await expect(page.getByTestId("prep-question-common-self-pr")).toHaveAttribute(
    "data-answer-state",
    "ready",
  );
  expect(jobCalls).toEqual([]);

  await page.getByTestId("prep-back").click();
  // prep-back still href="/" (product unchanged this round); re-enter board via rail.
  await expect(page).toHaveURL(/\/$/);
  await page
    .getByTestId("app-sidebar")
    .getByRole("link", { name: /応募進捗|Applications/ })
    .click();
  await expect(page).toHaveURL("/progress");
  await expect(page.getByRole("heading", { name: "応募進捗" })).toBeVisible();

  await context.close();
});

test("unknown application shows not-found shell when signed in", async ({
  browser,
  request,
}) => {
  const creds = await apiSignUp(request, { name: "準備 迷子" });
  const { page, context } = await newSignedInPage(browser, creds);

  await page.goto(
    "/applications/00000000-0000-4000-8000-000000000099/interview-prep",
  );
  await expect(page.getByTestId("interview-prep-not-found")).toBeVisible();
  await expect(page.getByTestId("prep-fallback-link")).toBeVisible();

  await context.close();
});
