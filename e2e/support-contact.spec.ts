import { expect, test } from "@playwright/test";

test.describe("お問い合わせ / support reports", () => {
  test.use({ locale: "ja-JP" });

  test("unsigned user sees inline form and can submit other inquiry", async ({
    page,
  }) => {
    await page.goto("/contact");
    await expect(page.getByTestId("contact-page")).toBeVisible();
    await expect(page.getByTestId("support-report-page-form")).toBeVisible();
    await expect(page.getByTestId("contact-open-form")).toHaveCount(0);
    await expect(page.getByTestId("support-report-dialog")).toHaveCount(0);

    await page.getByTestId("support-category-other").click();
    await page
      .getByTestId("support-report-message")
      .fill("E2E: 一般お問い合わせ（エラーコードなし）");
    await expect(page.getByTestId("support-report-message")).toHaveValue(
      "E2E: 一般お問い合わせ（エラーコードなし）",
    );
    await page.getByTestId("support-report-submit").click();

    await expect(page.getByTestId("support-report-success")).toBeVisible({
      timeout: 15_000,
    });
    const acceptance = page.getByTestId("support-acceptance-number");
    await expect(acceptance).toHaveText(/^WR-\d{8}-[A-F0-9]+$/i);
  });

  test("unsigned user can submit a bug report without error codes", async ({
    page,
  }) => {
    await page.goto("/contact");
    await page.getByTestId("support-category-bug").click();
    await expect(page.getByTestId("support-report-message")).toHaveAttribute(
      "placeholder",
      /どの画面で|Which screen|在哪个页面/,
    );
    await page
      .getByTestId("support-report-message")
      .fill("E2E: ボタンが反応しない（コードなし）");
    await page.getByTestId("support-report-submit").click();
    await expect(page.getByTestId("support-report-success")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("support-acceptance-number")).toHaveText(
      /^WR-\d{8}-[A-F0-9]+$/i,
    );
  });

  test("mobile width shows inline form ready to fill", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/contact");
    await expect(page.getByTestId("support-report-page-form")).toBeVisible();
    await page.getByTestId("support-report-message").fill("一時入力");
    await expect(page.getByTestId("support-report-message")).toHaveValue(
      "一時入力",
    );
    await expect(
      page.getByRole("heading", { name: /お問い合わせ|Contact|联系/ }),
    ).toBeVisible();
  });
});
