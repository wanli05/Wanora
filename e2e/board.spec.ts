import { expect, test } from "@playwright/test";
import { apiSignUp, newSignedInPage } from "./ai-helpers";

test("signed-in home is the progress board", async ({ browser, request }) => {
  const creds = await apiSignUp(request, { name: "山田 太郎" });
  const { page, context } = await newSignedInPage(browser, creds);

  await expect(page.getByRole("heading", { name: "応募進捗" })).toBeVisible();
  await expect(page.getByTestId("board-empty")).toBeVisible();

  await page.getByRole("button", { name: "応募を追加" }).first().click();
  await page.getByLabel("会社").fill("株式会社テスト");
  await page.getByLabel("職種").fill("ソフトウェアエンジニア");
  await page.getByRole("button", { name: "応募を保存" }).click();
  await expect(page.getByText("株式会社テスト")).toBeVisible();
  // Redesigned card shows stage chip + detail/prep CTAs (not nextPrep body text).
  const card = page.getByTestId(/^card-/).first();
  await expect(card).toBeVisible();
  await expect(card.getByText("書類選考")).toBeVisible();
  await expect(card.getByText("ソフトウェアエンジニア")).toBeVisible();
  await expect(card.getByRole("button", { name: "詳細を見る" })).toBeVisible();
  await expect(card.getByRole("button", { name: "面接準備" })).toBeVisible();
  await expect(page.getByTestId("task-bar")).toBeVisible();

  await context.close();
});
