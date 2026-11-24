/**
 * Module-level multifield refine (Profile 3-field / Project 4-field).
 */
import { expect, test } from "@playwright/test";
import {
  applyRefineToDraft,
  clickExactSaveAndWaitAction,
  closeSidebarIfOpen,
  createProjectAndReopen,
  MOCK_REFINE_PREFIX,
  newPhase1cSignedInPage,
  openProfileCareerEditor,
  pollProfileJaField,
  readProfileJaField,
  readProfileStrengthsText,
  readProjectJaField,
  refineOnce,
  rewriteComposerToSingleLabeledField,
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

  test("partial Apply: Project results-only; other fields untouched; Apply≠Save", async ({
    browser,
  }) => {
    const { page, context, email } = await newPhase1cSignedInPage(browser, {
      name: "MF Partial PJ",
    });
    const title = `MF-Partial-${Date.now()}`;
    const overviewRaw = "概要固定【OV】";
    const phasesRaw = "フェーズ固定【PH】";
    const respRaw = "業務固定【RS】";
    const resultsRaw = "実績原文【RT】";

    const projectId = await createProjectAndReopen(page, {
      title,
      overview: overviewRaw,
    });
    const form = page.getByTestId("mc-project-form");
    await form.getByTestId("mc-project-phases-input").fill(phasesRaw);
    await form.getByTestId("mc-project-responsibilities-input").fill(respRaw);
    await form.getByTestId("mc-project-results-input").fill(resultsRaw);
    await closeSidebarIfOpen(page);
    await clickExactSaveAndWaitAction(form, page);

    // Reopen to bind saved id + drafts.
    await page
      .getByTestId("mc-project-form")
      .getByRole("button", { name: "閉じる", exact: true })
      .click()
      .catch(() => undefined);
    await page
      .locator("article.mc-card")
      .filter({ hasText: title })
      .getByRole("button", { name: "編集", exact: true })
      .click();
    const form2 = page.getByTestId("mc-project-form");
    await expect(form2.locator('input[name="id"]')).toHaveValue(projectId);

    await form2.getByTestId("ai-refine-project-module").click();
    await rewriteComposerToSingleLabeledField(page, "results", resultsRaw);
    await sendRefineAndWaitApply(page);
    await applyRefineToDraft(page);

    await expect(form2.getByTestId("mc-project-results-input")).toContainText(
      MOCK_REFINE_PREFIX,
    );
    await expect(form2.getByTestId("mc-project-overview-input")).toHaveValue(
      overviewRaw,
    );
    await expect(form2.getByTestId("mc-project-phases-input")).toHaveValue(
      phasesRaw,
    );
    await expect(
      form2.getByTestId("mc-project-responsibilities-input"),
    ).toHaveValue(respRaw);

    expect(await readProjectJaField(email, projectId, "overview")).toBe(
      overviewRaw,
    );
    expect(await readProjectJaField(email, projectId, "phases")).toBe(
      phasesRaw,
    );
    expect(await readProjectJaField(email, projectId, "responsibilities")).toBe(
      respRaw,
    );
    expect(await readProjectJaField(email, projectId, "results")).toBe(
      resultsRaw,
    );

    await closeSidebarIfOpen(page);
    await clickExactSaveAndWaitAction(form2, page);
    await page.reload({ waitUntil: "networkidle" });
    await page
      .locator("aside.mc-side")
      .getByRole("button", { name: "プロジェクト" })
      .click();
    await page
      .locator("article.mc-card")
      .filter({ hasText: title })
      .getByRole("button", { name: "編集", exact: true })
      .click();
    const form3 = page.getByTestId("mc-project-form");
    await expect(form3.getByTestId("mc-project-results-input")).toContainText(
      MOCK_REFINE_PREFIX,
    );
    await expect(form3.getByTestId("mc-project-overview-input")).toHaveValue(
      overviewRaw,
    );
    expect(await readProjectJaField(email, projectId, "results")).toContain(
      MOCK_REFINE_PREFIX,
    );
    expect(await readProjectJaField(email, projectId, "overview")).toBe(
      overviewRaw,
    );

    await context.close();
  });

  test("partial Apply: Profile self_pr-only; job_summary/strengths untouched", async ({
    browser,
  }) => {
    const { page, context, email } = await newPhase1cSignedInPage(browser, {
      name: "MF Partial Profile",
    });
    const panel = await openProfileCareerEditor(page);
    const prRaw = "自己PR固定【PR】";
    const jobRaw = "要約固定【JS】";
    const strengthsRaw = "経験固定A\n経験固定B";
    await panel.getByTestId("mc-self-pr-input").fill(prRaw);
    await panel.getByTestId("mc-job-summary-input").fill(jobRaw);
    await panel.getByTestId("mc-strengths-input").fill(strengthsRaw);
    await clickExactSaveAndWaitAction(panel, page);

    const panel2 = await openProfileCareerEditor(page);
    await expect(panel2.getByTestId("mc-self-pr-input")).toHaveValue(prRaw);
    await panel2.getByTestId("ai-refine-profile-module").click();
    await rewriteComposerToSingleLabeledField(page, "self_pr", prRaw);
    await sendRefineAndWaitApply(page);
    await applyRefineToDraft(page);

    await expect(panel2.getByTestId("mc-self-pr-input")).toContainText(
      MOCK_REFINE_PREFIX,
    );
    await expect(panel2.getByTestId("mc-job-summary-input")).toHaveValue(
      jobRaw,
    );
    await expect(panel2.getByTestId("mc-strengths-input")).toHaveValue(
      strengthsRaw,
    );

    expect(await readProfileJaField(email, "self_pr")).not.toContain(
      MOCK_REFINE_PREFIX,
    );
    expect(await readProfileJaField(email, "job_summary")).toContain("【JS】");

    await closeSidebarIfOpen(page);
    await clickExactSaveAndWaitAction(panel2, page);
    expect(await pollProfileJaField(email, "self_pr", MOCK_REFINE_PREFIX)).toContain(
      "【PR】",
    );
    expect(await readProfileJaField(email, "job_summary")).toContain("【JS】");
    expect(await readProfileStrengthsText(email)).toContain("経験固定A");
    expect(await readProfileStrengthsText(email)).not.toContain(
      MOCK_REFINE_PREFIX,
    );

    await context.close();
  });

  test("multi Apply cancel leaves drafts unchanged", async ({ browser }) => {
    const { page, context } = await newPhase1cSignedInPage(browser, {
      name: "MF Cancel",
    });
    const panel = await openProfileCareerEditor(page);
    const prRaw = "キャンセルPR";
    const jobRaw = "キャンセル要約";
    await panel.getByTestId("mc-self-pr-input").fill(prRaw);
    await panel.getByTestId("mc-job-summary-input").fill(jobRaw);
    await panel.getByTestId("ai-refine-profile-module").click();
    await sendRefineAndWaitApply(page);

    page.once("dialog", (d) => {
      void d.dismiss();
    });
    await page.getByTestId("ai-apply-to-draft").click();
    await expect(panel.getByTestId("mc-self-pr-input")).toHaveValue(prRaw);
    await expect(panel.getByTestId("mc-job-summary-input")).toHaveValue(jobRaw);
    await expect(panel.getByTestId("mc-ai-draft-hint")).toHaveCount(0);

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
