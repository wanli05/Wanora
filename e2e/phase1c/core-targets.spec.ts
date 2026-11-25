/**
 * QA-01～12 core targets: self_pr / job_summary / employer A-B / project A-B.
 * Step 3B: exact Save, DB poll (not toast), reopen+assert id, lastRefineAssistant.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  applyRefineToDraft,
  clickExactSaveAndWaitAction,
  closeSidebarIfOpen,
  countEmployers,
  countProjects,
  createEmployerAndReopen,
  createProjectAndReopen,
  exactSaveButton,
  MOCK_REFINE_PREFIX,
  newPhase1cSignedInPage,
  openProfileCareerEditor,
  pollEmployerNarrative,
  pollProfileJaField,
  pollProjectOverview,
  readEmployerNarrative,
  readProjectOverview,
  sendRefineAndWaitApply,
} from "./helpers";

async function refineApplySaveProfileField(
  page: Page,
  email: string,
  opts: {
    testId: "mc-self-pr-input" | "mc-job-summary-input";
    dbField: "self_pr" | "job_summary";
    rawMarker: string;
    label: string;
  },
) {
  const panel = await openProfileCareerEditor(page);
  const raw = `${opts.label}${opts.rawMarker}`;
  await panel.getByTestId(opts.testId).fill(raw);

  // Module-level entry; Mock returns labeled pairs for non-empty drafts.
  await panel.getByTestId("ai-refine-profile-module").click();
  await sendRefineAndWaitApply(page);
  await applyRefineToDraft(page);
  await expect(panel.getByTestId(opts.testId)).toContainText(MOCK_REFINE_PREFIX);

  // Apply must not write DB yet.
  await expect
    .poll(async () => {
      try {
        await pollProfileJaField(email, opts.dbField, MOCK_REFINE_PREFIX, 2_000);
        return "written";
      } catch {
        return "absent";
      }
    })
    .toBe("absent");

  await closeSidebarIfOpen(page);
  await expect(exactSaveButton(panel)).toHaveCount(1);
  await clickExactSaveAndWaitAction(panel, page);

  const stored = await pollProfileJaField(
    email,
    opts.dbField,
    MOCK_REFINE_PREFIX,
  );
  expect(stored).toContain(opts.rawMarker);

  await page.reload({ waitUntil: "networkidle" });
  const panel2 = await openProfileCareerEditor(page);
  await expect(panel2.getByTestId(opts.testId)).toContainText(MOCK_REFINE_PREFIX);
}

test.describe("QA-01～12 core targets", () => {
  test("QA-01～12 profile/self_pr: refine → apply draft → save → reload DB", async ({
    browser,
  }) => {
    const { page, context, email } = await newPhase1cSignedInPage(browser, {
      name: "Core self_pr",
    });
    await refineApplySaveProfileField(page, email, {
      testId: "mc-self-pr-input",
      dbField: "self_pr",
      rawMarker: "【SELFPR-RAW】",
      label: "自己PR原文",
    });
    await context.close();
  });

  test("QA-01～12 profile/job_summary: refine → apply → save → DB", async ({
    browser,
  }) => {
    const { page, context, email } = await newPhase1cSignedInPage(browser, {
      name: "Core job_summary",
    });
    await refineApplySaveProfileField(page, email, {
      testId: "mc-job-summary-input",
      dbField: "job_summary",
      rawMarker: "【JOBSUM-RAW】",
      label: "職務要約原文",
    });
    await context.close();
  });

  test("QA-01～12 career_employer A/B isolation + save/reload DB", async ({
    browser,
  }) => {
    const { page, context, email } = await newPhase1cSignedInPage(browser, {
      name: "Core employer",
    });

    const companyA = `アルファ-${Date.now()}`;
    const companyB = `ベータ-${Date.now()}`;
    const idA = await createEmployerAndReopen(page, {
      company: companyA,
      narrative: "アルファ叙述【EMP-A-RAW】",
    });
    // Close A before creating B.
    await page
      .getByTestId("mc-employer-form")
      .getByRole("button", { name: "閉じる", exact: true })
      .click();

    const idB = await createEmployerAndReopen(page, {
      company: companyB,
      narrative: "ベータ叙述【EMP-B-RAW】",
    });
    expect(idA).not.toBe(idB);
    const countBefore = await countEmployers(email);

    // Reopen A and refine.
    await page
      .getByTestId("mc-employer-form")
      .getByRole("button", { name: "閉じる", exact: true })
      .click();
    await page
      .locator("article.mc-card")
      .filter({ hasText: companyA })
      .getByRole("button", { name: "編集", exact: true })
      .click();
    const formA = page.getByTestId("mc-employer-form");
    await expect(formA.locator('input[name="id"]')).toHaveValue(idA);

    await formA.getByTestId("ai-refine-narrative_ja").click();
    await sendRefineAndWaitApply(page);
    await applyRefineToDraft(page);
    await expect(formA.getByTestId("mc-employer-narrative-input")).toContainText(
      MOCK_REFINE_PREFIX,
    );
    await expect(formA.locator('input[name="id"]')).toHaveValue(idA);

    await closeSidebarIfOpen(page);
    await clickExactSaveAndWaitAction(formA, page);

    await pollEmployerNarrative(email, idA, "【EMP-A-REFINE】").catch(async () => {
      // Mock scheme A prefixes（モック修正案）+ original body; accept either refine marker or prefix.
      await pollEmployerNarrative(email, idA, MOCK_REFINE_PREFIX);
    });
    // Prefer asserting refine prefix which mock scheme A always includes.
    const aAfter = await readEmployerNarrative(email, idA);
    expect(aAfter).toContain(MOCK_REFINE_PREFIX);
    expect(aAfter).toContain("【EMP-A-RAW】");

    const bAfter = await readEmployerNarrative(email, idB);
    expect(bAfter).toContain("【EMP-B-RAW】");
    expect(bAfter).not.toContain(MOCK_REFINE_PREFIX);

    expect(await countEmployers(email)).toBe(countBefore);

    await page.reload({ waitUntil: "networkidle" });
    await page
      .getByTestId("mc-module-tabs")
      .getByRole("button", { name: "職歴" })
      .click();
    await page
      .locator("article.mc-card")
      .filter({ hasText: companyA })
      .getByRole("button", { name: "編集", exact: true })
      .click();
    await expect(
      page.getByTestId("mc-employer-form").locator('input[name="id"]'),
    ).toHaveValue(idA);
    await expect(
      page.getByTestId("mc-employer-narrative-input"),
    ).toContainText(MOCK_REFINE_PREFIX);

    await context.close();
  });

  test("QA-01～12 career_project A/B isolation + save/reload DB", async ({
    browser,
  }) => {
    const { page, context, email } = await newPhase1cSignedInPage(browser, {
      name: "Core project",
    });

    const titleA = `ガンマ-${Date.now()}`;
    const titleB = `デルタ-${Date.now()}`;
    const idA = await createProjectAndReopen(page, {
      title: titleA,
      overview: "ガンマ概要【PRJ-A-RAW】",
    });
    await page
      .getByTestId("mc-project-form")
      .getByRole("button", { name: "閉じる", exact: true })
      .click();
    const idB = await createProjectAndReopen(page, {
      title: titleB,
      overview: "デルタ概要【PRJ-B-RAW】",
    });
    const countBefore = await countProjects(email);

    await page
      .getByTestId("mc-project-form")
      .getByRole("button", { name: "閉じる", exact: true })
      .click();
    await page
      .locator("article.mc-card")
      .filter({ hasText: titleA })
      .getByRole("button", { name: "編集", exact: true })
      .click();
    const formA = page.getByTestId("mc-project-form");
    await expect(formA.locator('input[name="id"]')).toHaveValue(idA);

    await formA.getByTestId("ai-refine-project-module").click();
    await sendRefineAndWaitApply(page);
    await applyRefineToDraft(page);
    await expect(formA.getByTestId("mc-project-overview-input")).toContainText(
      MOCK_REFINE_PREFIX,
    );
    await expect(formA.locator('input[name="id"]')).toHaveValue(idA);

    await closeSidebarIfOpen(page);
    await clickExactSaveAndWaitAction(formA, page);

    await pollProjectOverview(email, idA, MOCK_REFINE_PREFIX);
    const aAfter = await readProjectOverview(email, idA);
    expect(aAfter).toContain("【PRJ-A-RAW】");
    const bAfter = await readProjectOverview(email, idB);
    expect(bAfter).toContain("【PRJ-B-RAW】");
    expect(bAfter).not.toContain(MOCK_REFINE_PREFIX);
    expect(await countProjects(email)).toBe(countBefore);

    await context.close();
  });
});

// silence unused Browser import if tree-shaken oddly
void (null as unknown as Browser);
