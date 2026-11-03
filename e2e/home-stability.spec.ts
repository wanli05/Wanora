import { expect, test } from "@playwright/test";

test("home page does not enter a reload loop", async ({ page }) => {
  let loads = 0;
  page.on("load", () => {
    loads += 1;
  });
  await page.goto("/");
  await page.waitForTimeout(3000);
  expect(loads).toBeLessThanOrEqual(2);
});
