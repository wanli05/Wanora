import { expect, test } from "@playwright/test";
import { apiSignUp, closeAiSidebar, newSignedInPage } from "./ai-helpers";

test("board 面接準備 shows seven base themes and AI sidebar entry", async ({
  browser,
  request,
}) => {
  const creds = await apiSignUp(request, { name: "面接 準備" });
  const { page, context } = await newSignedInPage(browser, creds);

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
  await expect(page.getByText("準備テスト株式会社")).toBeVisible();

  const card = page.getByTestId(/^card-/).first();
  await card.getByRole("button", { name: "面接準備" }).click();

  await expect(page).toHaveURL(/\/applications\/[^/]+\/interview-prep$/);
  await expect(page.getByTestId("interview-prep-page")).toBeVisible();
  await expect(page.getByTestId("prep-company")).toHaveText("準備テスト株式会社");
  await expect(page.getByTestId("prep-schedule-status")).toContainText("面接未定");
  await expect(page.getByTestId("prep-questions")).toHaveAttribute(
    "data-base-count",
    "7",
  );
  await expect(page.getByTestId("prep-refer-career")).toHaveAttribute(
    "data-status",
    "unused",
  );
  await expect(page.getByText("保存しました")).toHaveCount(0);

  const jobCalls: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/ai/jobs")) jobCalls.push(req.url());
  });

  await page.getByTestId("prep-question-toggle-base-motivation").click();
  await expect(
    page.getByTestId("prep-question-details-base-motivation"),
  ).toContainText("準備のポイント");
  await expect(page.getByTestId("prep-generate-base-motivation")).toHaveCount(0);

  await page
    .getByTestId("prep-editor-input-base-motivation")
    .fill("E2Eで編集した回答");
  await expect(
    page.getByTestId("prep-editor-input-base-motivation"),
  ).toHaveValue("E2Eで編集した回答");

  await page.getByTestId("prep-question-toggle-base-reverse-qa").click();
  await page.getByTestId("prep-reverse-add-base-reverse-qa").click();
  await expect(
    page.getByTestId("prep-reverse-item-base-reverse-qa-1"),
  ).toBeVisible();

  await page.getByTestId("prep-custom-input").fill("チーム構成を教えてください。");
  await page.getByTestId("prep-custom-add").click();
  await expect(page.getByTestId("prep-custom-demo-hint")).toContainText(
    "データベースには保存されません",
  );

  await page.getByTestId("prep-ai-assist-base-motivation").click();
  await expect(page.getByTestId("ai-sidebar-panel")).toHaveAttribute(
    "data-open",
    "true",
  );
  expect(jobCalls).toEqual([]);

  await closeAiSidebar(page);
  await page.getByTestId("prep-back").click();
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
