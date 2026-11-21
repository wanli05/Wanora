import { expect, test } from "@playwright/test";
import { apiSignUp, newSignedInPage } from "./ai-helpers";

test("board 面接準備 opens the read-only prep page without a scheduled interview", async ({
  browser,
  request,
}) => {
  const creds = await apiSignUp(request, { name: "面接 準備" });
  const { page, context } = await newSignedInPage(browser, creds);

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
  await expect(page.getByTestId("prep-role")).toHaveText("バックエンドエンジニア");
  await expect(page.getByTestId("prep-schedule-status")).toContainText("面接未定");
  await expect(page.getByTestId("prep-questions-placeholder")).toBeVisible();

  await page.getByTestId("prep-back").click();
  await expect(page).toHaveURL(/\/$/);
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
