import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

const localeCookie = {
  name: "NEXT_LOCALE",
  value: "ja",
  domain: "localhost",
  path: "/",
  sameSite: "Lax" as const,
};

test("signed-in user can open profile and add education", async ({
  page,
  context,
}) => {
  await context.addCookies([localeCookie]);
  const email = `e2e-profile-${randomUUID()}@example.test`;
  const password = "correct-horse-battery";

  await page.goto("/sign-up");
  await page.getByLabel("氏名").fill("山田 太郎");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(password);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page).toHaveURL("/");

  await page.getByRole("link", { name: "個人資料" }).click();
  await expect(page).toHaveURL("/profile");
  await page.locator("#fullName_ja").fill("山田太郎");
  await page.getByRole("button", { name: "基本情報を保存" }).click();

  await page.getByRole("link", { name: "学歴" }).click();
  await page.locator('input[name="year"]').fill("2020");
  await page.locator('input[name="month"]').fill("4");
  await page.locator("#school_ja").fill("テスト大学");
  await page.getByRole("button", { name: "追加" }).click();
  await expect(page.getByText("テスト大学")).toBeVisible();
});
