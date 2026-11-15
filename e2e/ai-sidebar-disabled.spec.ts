import { expect, test } from "@playwright/test";
import {
  apiSignUp,
  expectAiStatus,
  newSignedInPage,
} from "./ai-helpers";

/**
 * Runs only under playwright.ai-disabled.config.ts (AI_ENABLED=false, isolated port).
 */
test.describe("A8-03 AI disabled gate", () => {
  test("hides floating entry for signed-in users when AI_ENABLED=false", async ({
    browser,
    request,
  }) => {
    await expectAiStatus(request, false);
    const creds = await apiSignUp(request, { name: "A8 Disabled" });
    const { page, context } = await newSignedInPage(browser, creds);
    try {
      await expect(page.getByTestId("signed-in-as")).toBeVisible();
      await expect(page.getByTestId("ai-sidebar-toggle")).toHaveCount(0);
      await expect(page.getByTestId("ai-sidebar-panel")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
