import { expect, test } from "@playwright/test";

test.describe("お問い合わせ / support reports", () => {
  test("unsigned user can submit a general inquiry and see acceptance number", async ({
    page,
  }) => {
    await page.goto("/contact");
    await expect(page.getByTestId("contact-open-form")).toBeVisible();
    await page.getByTestId("contact-open-form").click();
    await expect(page.getByTestId("support-report-dialog")).toBeVisible();

    await page.getByLabel(/その他|Other|其他/).check();
    await page.getByTestId("support-report-message").fill(
      "E2E: 一般お問い合わせ（エラーコードなし）",
    );
    await page.getByTestId("support-report-submit").click();

    await expect(page.getByTestId("support-report-success")).toBeVisible({
      timeout: 15_000,
    });
    const acceptance = page.getByTestId("support-acceptance-number");
    await expect(acceptance).toHaveText(/^WR-\d{8}-[A-F0-9]+$/i);
  });

  test("mobile width can open and cancel without losing prior page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/contact");
    await page.getByTestId("contact-open-form").click();
    await page.getByTestId("support-report-message").fill("一時入力");
    await page.getByTestId("support-report-cancel").click();
    await expect(page.getByTestId("support-report-dialog")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /お問い合わせ|Contact|联系/ })).toBeVisible();
  });
});
