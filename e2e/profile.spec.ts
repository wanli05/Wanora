import { expect, test } from "@playwright/test";
import { apiSignUp, newSignedInPage } from "./ai-helpers";

test("signed-in user can edit profile and add education on one page", async ({
  browser,
  request,
}) => {
  // API signup avoids UI race / Better Auth 429 under parallel workers
  // (previous flaky: stayed on /sign-up after click).
  const creds = await apiSignUp(request, { name: "山田 太郎" });
  const { page, context } = await newSignedInPage(browser, creds);

  // Home also has a マイキャリア card — scope to the left rail.
  await page
    .getByTestId("app-sidebar")
    .getByRole("link", { name: /マイキャリア|My Career/ })
    .click();
  await expect(page).toHaveURL("/profile");

  // Career overview has its own 編集; resume fields live in .mc-resume-wrap.
  await expect(page.locator(".mc-meta-grid")).toBeVisible();
  await expect(page.locator(".mc-identity")).toBeVisible();
  const resumeWrap = page.locator(".mc-resume-wrap");
  await resumeWrap.getByRole("button", { name: "編集" }).click();
  // Sign-up may stay mounted (Activity); prefer #fullName_ja over getByLabel("氏名").
  await expect(page.locator("#fullName_ja")).toBeVisible();
  await expect(resumeWrap.getByRole("status")).not.toBeVisible();

  const resumeForm = resumeWrap.locator("form").filter({
    has: page.locator("#fullName_ja"),
  });

  await page.locator("#fullName_ja").fill("山田太郎");
  await resumeForm.getByRole("button", { name: "行を追加" }).first().click();
  await page.locator('input[name="education.0.yearMonth"]').fill("2020-04");
  await page.locator('input[name="education.0.school_ja"]').fill("テスト大学");
  await resumeForm.getByRole("button", { name: "保存" }).click();

  await expect(page.getByRole("cell", { name: "テスト大学" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("cell", { name: "2020年4月" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "入学" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("個人資料を保存しました。");

  await context.close();
});
