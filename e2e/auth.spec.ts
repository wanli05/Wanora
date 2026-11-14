import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

const localeCookie = {
  name: "NEXT_LOCALE",
  value: "ja",
  domain: "localhost",
  path: "/",
  sameSite: "Lax" as const,
};

test("sign up, sign out, and sign back in", async ({ page, context }) => {
  await context.addCookies([localeCookie]);
  const email = `e2e-${randomUUID()}@example.test`;
  const password = "correct-horse-battery";

  await page.goto("/");
  await page.getByRole("link", { name: "新規登録" }).click();
  await expect(page).toHaveURL("/sign-up");
  await page.getByLabel("氏名").fill("山田 太郎");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(password);
  await page.getByRole("button", { name: "登録する" }).click();

  await expect(page).toHaveURL("/");
  // Header shows profile/session name + photo chip — never the account email.
  await expect(page.getByTestId("signed-in-as")).toContainText("山田 太郎");

  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page.getByRole("link", { name: "ログイン" })).toBeVisible();

  await page.getByRole("link", { name: "ログイン" }).click();
  await expect(page).toHaveURL("/sign-in");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill("wrong-password");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(
    page.getByText("メールアドレスまたはパスワードが正しくありません"),
  ).toBeVisible();
  await expect(page).toHaveURL("/sign-in");

  await page.getByLabel("パスワード").fill(password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByTestId("signed-in-as")).toContainText("山田 太郎");
});
