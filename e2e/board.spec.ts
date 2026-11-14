import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("signed-in home is the progress board", async ({ page, context }) => {
  await context.addCookies([
    {
      name: "NEXT_LOCALE",
      value: "ja",
      domain: "localhost",
      path: "/",
      sameSite: "Lax",
    },
  ]);
  const email = `e2e-board-${randomUUID()}@example.test`;
  await page.goto("/sign-up");
  await page.getByLabel("氏名").fill("山田 太郎");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill("correct-horse-battery");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page).toHaveURL("/");
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
});
