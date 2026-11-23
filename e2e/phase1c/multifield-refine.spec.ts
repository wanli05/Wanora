/**
 * Module-level multifield refine (Profile 3-field / Project 4-field).
 */
import { expect, test } from "@playwright/test";
import {
  applyRefineToDraft,
  closeSidebarIfOpen,
  createProjectAndReopen,
  MOCK_REFINE_PREFIX,
  newPhase1cSignedInPage,
  openProfileCareerEditor,
  pollProfileJaField,
  refineOnce,
  sendRefineAndWaitApply,
} from "./helpers";

test.describe("multifield module refine", () => {
  test("E1/E2/E3: profile module button; no field buttons; apply three fields; no auto-send", async ({
    browser,
  }) => {
    const { page, context, email } = await newPhase1cSignedInPage(browser, {
      name: "MF Profile",
    });
    const panel = await openProfileCareerEditor(page);
    await expect(panel.getByTestId("ai-refine-profile-module")).toBeVisible();
    await expect(panel.getByTestId("ai-refine-selfPr_ja")).toHaveCount(0);
    await expect(panel.getByTestId("ai-refine-jobSummary_ja")).toHaveCount(0);

    await panel.getByTestId("mc-self-pr-input").fill("MF-PR原文");
    await panel.getByTestId("mc-job-summary-input").fill("MF-要約原文");
    await panel.getByTestId("mc-strengths-input").fill("経験1\n経験2");

    await panel.getByTestId("ai-refine-profile-module").click();
    await expect(page.getByTestId("ai-sidebar-panel")).toHaveAttribute(
      "data-assist-slot-key",
      "refine:profile:module",
    );
    // No auto-send: composer prefilled, no assistant refine yet.
    await expect(page.getByTestId("ai-composer-input")).toContainText(
      "【添削対象:self_pr】",
    );
    await expect(page.getByTestId("ai-composer-input")).toContainText(
      "【添削対象:strengths】",
    );
    await expect(page.getByTestId("ai-msg-assistant")).toHaveCount(0);

    await sendRefineAndWaitApply(page);
    await applyRefineToDraft(page);

    await expect(panel.getByTestId("mc-self-pr-input")).toContainText(
      MOCK_REFINE_PREFIX,
    );
    await expect(panel.getByTestId("mc-job-summary-input")).toContainText(
      MOCK_REFINE_PREFIX,
    );
    await expect(panel.getByTestId("mc-strengths-input")).toContainText(
      MOCK_REFINE_PREFIX,
    );
    await expect(panel.getByTestId("mc-strengths-input")).toHaveValue(
      new RegExp(`${MOCK_REFINE_PREFIX}経験1\\n経験2`),
    );

    // Apply ≠ Save
    await expect
      .poll(async () => {
        try {
          await pollProfileJaField(email, "self_pr", MOCK_REFINE_PREFIX, 2_000);
          return "written";
        } catch {
          return "absent";
        }
      })
      .toBe("absent");

    await closeSidebarIfOpen(page);
    await context.close();
  });

  test("E6: project four-field apply", async ({ browser }) => {
    const { page, context } = await newPhase1cSignedInPage(browser, {
      name: "MF Project",
    });
    const title = `MF-PJ-${Date.now()}`;
    await createProjectAndReopen(page, {
      title,
      overview: "概要原文",
    });
    const form = page.getByTestId("mc-project-form");
    await form.getByTestId("mc-project-phases-input").fill("フェーズ原文");
    await form
      .getByTestId("mc-project-responsibilities-input")
      .fill("業務原文");
    await form.getByTestId("mc-project-results-input").fill("実績原文");

    await expect(form.getByTestId("ai-refine-project-module")).toBeVisible();
    await expect(form.getByTestId("ai-refine-overview_ja")).toHaveCount(0);

    await refineOnce(page, "ai-refine-project-module");
    await applyRefineToDraft(page);

    await expect(form.getByTestId("mc-project-overview-input")).toContainText(
      MOCK_REFINE_PREFIX,
    );
    await expect(form.getByTestId("mc-project-phases-input")).toContainText(
      MOCK_REFINE_PREFIX,
    );
    await expect(
      form.getByTestId("mc-project-responsibilities-input"),
    ).toContainText(MOCK_REFINE_PREFIX);
    await expect(form.getByTestId("mc-project-results-input")).toContainText(
      MOCK_REFINE_PREFIX,
    );

    await closeSidebarIfOpen(page);
    await context.close();
  });

  test("E9: button hit-box — label gap click does not open; button does", async ({
    browser,
  }) => {
    const { page, context } = await newPhase1cSignedInPage(browser, {
      name: "MF Hitbox",
    });
    const panel = await openProfileCareerEditor(page);
    const btn = panel.getByTestId("ai-refine-profile-module");
    await expect(btn).toHaveClass(/mc-btn-ai-refine/);

    const box = await btn.boundingBox();
    expect(box).toBeTruthy();
    // Click heading text (not the AI button) — must not open Assist.
    await panel.locator(".mc-module-title-row h3").click();
    const sidebar = page.getByTestId("ai-sidebar-panel");
    if ((await sidebar.count()) > 0) {
      await expect(sidebar).not.toHaveAttribute("data-open", "true");
      await expect(sidebar).not.toHaveAttribute(
        "data-assist-slot-key",
        "refine:profile:module",
      );
    }

    await btn.click();
    await expect(page.getByTestId("ai-sidebar-panel")).toHaveAttribute(
      "data-open",
      "true",
    );
    await expect(page.getByTestId("ai-sidebar-panel")).toHaveAttribute(
      "data-assist-slot-key",
      "refine:profile:module",
    );

    await closeSidebarIfOpen(page);
    await context.close();
  });
});
