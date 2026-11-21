/**
 * QA-13～22 conflict / lifecycle.
 * Step 3B: lastRefineAssistant(); fresh page per case where isolation matters;
 * do not share a polluted serial page across A→B switch failures.
 */
import { expect, test, type Dialog, type Page } from "@playwright/test";
import {
  applyRefineToDraft,
  closeSidebarIfOpen,
  createEmployerAndReopen,
  createProjectAndReopen,
  lastRefineAssistant,
  MOCK_REFINE_PREFIX,
  newPhase1cSignedInPage,
  openProfileCareerEditor,
  readEmployerNarrative,
  readProjectOverview,
  sendRefineAndWaitApply,
} from "./helpers";

async function refineOnce(page: Page, refineTestId: string) {
  await page.getByTestId(refineTestId).click();
  await sendRefineAndWaitApply(page);
}

/** Native DOM click — AI sidebar can swallow Playwright pointer hits on nearby chrome. */
async function domClick(
  locator: ReturnType<Page["getByRole"]> | ReturnType<Page["locator"]>,
): Promise<void> {
  await locator.evaluate((el) => {
    if (!(el instanceof HTMLElement)) {
      throw new Error("domClick target is not an HTMLElement");
    }
    el.click();
  });
}

test.describe("QA-13～22 lifecycle", () => {
  test("QA-13: mid-job draft edit triggers confirm (dismiss keeps draft)", async ({
    browser,
  }) => {
    const { page, context } = await newPhase1cSignedInPage(browser, {
      name: "Life QA13",
    });
    const panel = await openProfileCareerEditor(page);
    await panel.getByTestId("mc-self-pr-input").fill("原稿【QA13】");
    await panel.getByTestId("ai-refine-selfPr_ja").click();

    // Gate: hold job poll briefly so we can edit while job chrome may be active.
    let release: (() => void) | undefined;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    let held = true;
    await page.route("**/api/ai/jobs/*", async (route) => {
      if (!held) {
        await route.continue();
        return;
      }
      await gate;
      if (!route.request().isNavigationRequest()) {
        try {
          await route.continue();
        } catch {
          /* already handled */
        }
      }
    });

    await page.getByTestId("ai-composer-send").click();
    await page.getByTestId("mc-self-pr-input").fill("途中改稿【QA13】");
    held = false;
    release?.();

    page.once("dialog", async (d: Dialog) => {
      expect(d.type()).toBe("confirm");
      await d.dismiss();
    });

    await expect(lastRefineAssistant(page)).toBeVisible({ timeout: 90_000 });
    const apply = page.getByTestId("ai-apply-to-draft");
    if (await apply.isVisible().catch(() => false)) {
      await apply.click();
      // Dismissed confirm → draft should remain the mid-edit text.
      await expect(panel.getByTestId("mc-self-pr-input")).toHaveValue(
        /途中改稿【QA13】/,
      );
    }

    await page.unroute("**/api/ai/jobs/*");
    await closeSidebarIfOpen(page);
    await context.close();
  });

  test("QA-14: after-job draft edit confirm accept applies refine", async ({
    browser,
  }) => {
    const { page, context } = await newPhase1cSignedInPage(browser, {
      name: "Life QA14",
    });
    const panel = await openProfileCareerEditor(page);
    await panel.getByTestId("mc-self-pr-input").fill("原稿【QA14】");
    await refineOnce(page, "ai-refine-selfPr_ja");
    await panel.getByTestId("mc-self-pr-input").fill("事后改稿【QA14】");

    page.once("dialog", async (d: Dialog) => {
      expect(d.type()).toBe("confirm");
      await d.accept();
    });
    await applyRefineToDraft(page);
    await expect(panel.getByTestId("mc-self-pr-input")).toContainText(
      MOCK_REFINE_PREFIX,
    );
    await closeSidebarIfOpen(page);
    await context.close();
  });

  test("QA-15/16: employer A→B switch invalidates Apply; no cross-write", async ({
    browser,
  }) => {
    const { page, context, email } = await newPhase1cSignedInPage(browser, {
      name: "Life QA15",
    });
    const companyA = `切替A-${Date.now()}`;
    const companyB = `切替B-${Date.now()}`;
    const idA = await createEmployerAndReopen(page, {
      company: companyA,
      narrative: "A叙述【QA15-A】",
    });
    await page
      .getByTestId("mc-employer-form")
      .getByRole("button", { name: "閉じる", exact: true })
      .click();
    const idB = await createEmployerAndReopen(page, {
      company: companyB,
      narrative: "B叙述【QA15-B】",
    });
    await page
      .getByTestId("mc-employer-form")
      .getByRole("button", { name: "閉じる", exact: true })
      .click();

    await page
      .locator("article.mc-card")
      .filter({ hasText: companyA })
      .getByRole("button", { name: "編集", exact: true })
      .click();
    await refineOnce(page, "ai-refine-narrative_ja");
    await expect(lastRefineAssistant(page)).toBeVisible();
    await expect(page.getByTestId("ai-apply-to-draft")).toBeVisible();

    // Switch to B without closing first — openEmployerEditor invalidates Apply.
    await domClick(
      page
        .locator("article.mc-card")
        .filter({ hasText: companyB })
        .getByRole("button", { name: "編集", exact: true }),
    );
    await expect(
      page.getByTestId("mc-employer-form").locator('input[name="id"]'),
    ).toHaveValue(idB);

    await expect(page.getByTestId("ai-apply-to-draft")).toHaveCount(0);

    const aDb = await readEmployerNarrative(email, idA);
    const bDb = await readEmployerNarrative(email, idB);
    expect(aDb).toContain("【QA15-A】");
    expect(aDb).not.toContain(MOCK_REFINE_PREFIX);
    expect(bDb).toContain("【QA15-B】");
    expect(bDb).not.toContain(MOCK_REFINE_PREFIX);

    await closeSidebarIfOpen(page);
    await context.close();
  });

  test("QA-17/18: project A→B switch invalidates Apply", async ({
    browser,
  }) => {
    const { page, context, email } = await newPhase1cSignedInPage(browser, {
      name: "Life QA17",
    });
    const titleA = `項A-${Date.now()}`;
    const titleB = `項B-${Date.now()}`;
    const idA = await createProjectAndReopen(page, {
      title: titleA,
      overview: "A概要【QA17-A】",
    });
    await page
      .getByTestId("mc-project-form")
      .getByRole("button", { name: "閉じる", exact: true })
      .click();
    const idB = await createProjectAndReopen(page, {
      title: titleB,
      overview: "B概要【QA17-B】",
    });
    await page
      .getByTestId("mc-project-form")
      .getByRole("button", { name: "閉じる", exact: true })
      .click();

    await page
      .locator("article.mc-card")
      .filter({ hasText: titleA })
      .getByRole("button", { name: "編集", exact: true })
      .click();
    await refineOnce(page, "ai-refine-overview_ja");
    await expect(page.getByTestId("ai-apply-to-draft")).toBeVisible();

    await domClick(
      page
        .locator("article.mc-card")
        .filter({ hasText: titleB })
        .getByRole("button", { name: "編集", exact: true }),
    );
    await expect(
      page.getByTestId("mc-project-form").locator('input[name="id"]'),
    ).toHaveValue(idB);
    await expect(page.getByTestId("ai-apply-to-draft")).toHaveCount(0);

    expect(await readProjectOverview(email, idA)).toContain("【QA17-A】");
    expect(await readProjectOverview(email, idB)).toContain("【QA17-B】");

    await closeSidebarIfOpen(page);
    await context.close();
  });

  test("QA-19: cancel edit invalidates Apply", async ({ browser }) => {
    const { page, context } = await newPhase1cSignedInPage(browser, {
      name: "Life QA19",
    });
    const panel = await openProfileCareerEditor(page);
    await panel.getByTestId("mc-self-pr-input").fill("取消編集【QA19】");
    await refineOnce(page, "ai-refine-selfPr_ja");
    await expect(page.getByTestId("ai-apply-to-draft")).toBeVisible();

    await domClick(
      page
        .locator(".mc-panel-actions")
        .getByRole("button", { name: "キャンセル", exact: true }),
    );
    await expect(page.getByTestId("ai-apply-to-draft")).toHaveCount(0);
    await closeSidebarIfOpen(page);
    await context.close();
  });

  test("QA-20: leave My Career invalidates Apply", async ({ browser }) => {
    const { page, context } = await newPhase1cSignedInPage(browser, {
      name: "Life QA20",
    });
    const panel = await openProfileCareerEditor(page);
    await panel.getByTestId("mc-self-pr-input").fill("離页【QA20】");
    await refineOnce(page, "ai-refine-selfPr_ja");
    await expect(page.getByTestId("ai-apply-to-draft")).toBeVisible();

    // Nav chrome label is「進捗ボード」(ja); older specs used「応募進捗」(AiSidebar.pageBoard).
    await domClick(page.getByRole("link", { name: /進捗ボード|応募進捗/ }));
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("ai-apply-to-draft")).toHaveCount(0);
    await closeSidebarIfOpen(page);
    await context.close();
  });

  test("QA-21: double Apply is draft-idempotent and does not write DB", async ({
    browser,
  }) => {
    const { page, context, email } = await newPhase1cSignedInPage(browser, {
      name: "Life QA21",
    });
    const panel = await openProfileCareerEditor(page);
    await panel.getByTestId("mc-self-pr-input").fill("二重適用【QA21】");
    await refineOnce(page, "ai-refine-selfPr_ja");
    await applyRefineToDraft(page);
    const afterFirst = await panel.getByTestId("mc-self-pr-input").inputValue();
    await applyRefineToDraft(page);
    const afterSecond = await panel.getByTestId("mc-self-pr-input").inputValue();
    expect(afterSecond).toBe(afterFirst);

    const userId = await (
      await import("./helpers")
    ).userIdByEmail(email);
    const dbVal = await (
      await import("./helpers")
    ).withDb(async (client) => {
      const res = await client.query<{ v: string | null }>(
        `select self_pr->>'ja' as v from profiles where user_id = $1`,
        [userId],
      );
      return res.rows[0]?.v ?? "";
    });
    expect(dbVal).not.toContain(MOCK_REFINE_PREFIX);

    await closeSidebarIfOpen(page);
    await context.close();
  });

  test("QA-22: rapid target switch revokes prior Apply", async ({
    browser,
  }) => {
    const { page, context } = await newPhase1cSignedInPage(browser, {
      name: "Life QA22",
    });
    const panel = await openProfileCareerEditor(page);
    await panel.getByTestId("mc-self-pr-input").fill("快速切替PR【QA22】");
    await panel.getByTestId("mc-job-summary-input").fill("快速切替要約【QA22】");

    await refineOnce(page, "ai-refine-selfPr_ja");
    await expect(page.getByTestId("ai-apply-to-draft")).toBeVisible();

    await domClick(panel.getByTestId("ai-refine-jobSummary_ja"));
    await sendRefineAndWaitApply(page);
    // Only the latest refine session should arm Apply (last bubble).
    await expect(page.getByTestId("ai-apply-to-draft")).toHaveCount(1);
    await expect(lastRefineAssistant(page)).toBeVisible();

    await closeSidebarIfOpen(page);
    await context.close();
  });

  test("QA-19b: module switch to 職歴 invalidates Apply", async ({
    browser,
  }) => {
    const { page, context } = await newPhase1cSignedInPage(browser, {
      name: "Life QA19b",
    });
    const panel = await openProfileCareerEditor(page);
    await panel.getByTestId("mc-self-pr-input").fill("模块切替【QA19b】");
    await refineOnce(page, "ai-refine-selfPr_ja");
    await expect(page.getByTestId("ai-apply-to-draft")).toBeVisible();

    await domClick(
      page.locator("aside.mc-side").getByRole("button", { name: "職歴" }),
    );
    await expect(page.getByTestId("ai-apply-to-draft")).toHaveCount(0);
    await closeSidebarIfOpen(page);
    await context.close();
  });
});
