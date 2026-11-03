import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

const localeCookie = {
  name: "NEXT_LOCALE",
  value: "ja",
  domain: "localhost",
  path: "/",
  sameSite: "Lax" as const,
};

test("signed-in user can edit profile and add education on one page", async ({
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

  await page.getByRole("button", { name: "編集" }).click();
  await expect(page.getByLabel("氏名")).toBeVisible();
  await expect(page.getByText("個人資料を保存しました。")).not.toBeVisible();

  await page.locator("#fullName_ja").fill("山田太郎");
  await page.getByRole("button", { name: "行を追加" }).first().click();
  await page.locator('input[name="education.0.yearMonth"]').fill("2020-04");
  await page.locator('input[name="education.0.school_ja"]').fill("テスト大学");
  await page.getByRole("button", { name: "保存" }).click();

  await expect(page.getByText("個人資料を保存しました。")).toBeVisible();
  await expect(page.getByRole("cell", { name: "テスト大学" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "2020年4月" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "入学" })).toBeVisible();
});
