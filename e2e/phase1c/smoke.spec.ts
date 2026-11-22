/**
 * Phase 1C-QA smoke: isolation stack + self_pr refine → Apply to draft.
 * Does not assert Save→DB (covered by core-targets / diagnose-save).
 */
import { expect, test } from "@playwright/test";
import {
  applyRefineToDraft,
  closeSidebarIfOpen,
  databaseUrl,
  expectAiStatusMock,
  MOCK_REFINE_PREFIX,
  newPhase1cSignedInPage,
  openProfileCareerEditor,
  sendRefineAndWaitApply,
} from "./helpers";

test.describe("Phase1C smoke", () => {
  test("status mock + self_pr refine Apply to draft only", async ({
    browser,
    request,
  }) => {
    expect(databaseUrl()).not.toMatch(/wanora/i);
    await expectAiStatusMock(request);

    const { page, context } = await newPhase1cSignedInPage(browser, {
      name: "Smoke User",
    });

    const panel = await openProfileCareerEditor(page);
    const marker = "【SMOKE-SELFPR】";
    await panel
      .getByTestId("mc-self-pr-input")
      .fill(`煙测自己PR${marker}`);

    await panel.getByTestId("ai-refine-selfPr_ja").click();
    await expect(page.getByTestId("ai-sidebar-panel")).toHaveAttribute(
      "data-open",
      "true",
    );
    await expect(page.getByTestId("ai-composer-input")).toContainText(
      "【添削対象本文】",
    );

    await sendRefineAndWaitApply(page);
    await applyRefineToDraft(page);

    await expect(panel.getByTestId("mc-self-pr-input")).toContainText(
      MOCK_REFINE_PREFIX,
    );
    await expect(panel.getByTestId("mc-self-pr-input")).toContainText(marker);
    await expect(page.getByTestId("mc-ai-draft-hint")).toBeVisible();

    await closeSidebarIfOpen(page);
    await context.close();
  });
});
