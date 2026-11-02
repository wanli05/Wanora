import { expect, test } from "@playwright/test";

const cases = [
  {
    locale: "ja",
    tagline: "日本で就職・転職活動をする人のための応募管理アプリ",
    signIn: "ログイン",
  },
  {
    locale: "zh-CN",
    tagline: "面向在日本求职者的投递进度管理应用",
    signIn: "登录",
  },
  {
    locale: "en",
    tagline: "Job application tracker for job seekers in Japan",
    signIn: "Sign in",
  },
] as const;

for (const { locale, tagline, signIn } of cases) {
  test(`home and nav render in ${locale}`, async ({ page, context }) => {
    await context.addCookies([
      {
        name: "NEXT_LOCALE",
        value: locale,
        domain: "localhost",
        path: "/",
        sameSite: "Lax",
      },
    ]);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.getByText(tagline)).toBeVisible();
    await expect(page.getByRole("link", { name: signIn })).toBeVisible();
  });
}

test("language switcher changes UI copy", async ({ page, context }) => {
  await context.addCookies([
    {
      name: "NEXT_LOCALE",
      value: "ja",
      domain: "localhost",
      path: "/",
      sameSite: "Lax",
    },
  ]);
  await page.goto("/");
  await Promise.all([
    page.waitForLoadState("load"),
    page.getByLabel("表示言語").selectOption("en"),
  ]);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByText("Job application tracker for job seekers in Japan"),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

  await Promise.all([
    page.waitForLoadState("load"),
    page.getByLabel("Language").selectOption("zh-CN"),
  ]);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByRole("link", { name: "登录" })).toBeVisible();
});
