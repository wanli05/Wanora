/**
 * Step 3B / 3C isolation diagnostics (D1–D3).
 *
 * D1 — Profile exact Save → DB poll (no toast authority)
 * D2 — Employer Apply → Save same id + no ghost create
 * D3 — Document「保存」substring selector pollution
 *
 * Run:
 *   pnpm exec tsx scripts/phase1c-qa-e2e-runner.mts -- e2e/phase1c/diagnose-save.spec.ts
 *
 * Apply paths (D2) require Step 2 mock scheme A (【修正案】). If mock still
 * returns only【モック応答】, D2 will fail at Apply — record as product/prereq
 * blocker; do not weaken assertions.
 */
import { expect, test } from "@playwright/test";
import {
  applyRefineToDraft,
  clickExactSaveAndWaitAction,
  closeSidebarIfOpen,
  countEmployers,
  createEmployerAndReopen,
  exactSaveButton,
  lastRefineAssistant,
  MOCK_REFINE_PREFIX,
  newPhase1cSignedInPage,
  openProfileCareerEditor,
  pollEmployerNarrative,
  pollProfileJaField,
  sendRefineAndWaitApply,
} from "./helpers";

test.describe("Phase1C diagnose-save D1–D3", () => {
  test.describe.configure({ mode: "serial" });

  test("D1 Profile exact Save→DB (no toast authority)", async ({
    browser,
  }) => {
    const { page, context, email } = await newPhase1cSignedInPage(browser, {
      name: "Diagnose D1",
    });

    const panel = await openProfileCareerEditor(page);
    const marker = "【D1-SELFPR-MARK】";
    const body = `診断用自己PR本文${marker}`;

    await panel.getByTestId("mc-self-pr-input").fill(body);

    // Exact Save — must not match refine buttons.
    const saves = exactSaveButton(panel);
    await expect(saves).toHaveCount(1);
    await clickExactSaveAndWaitAction(panel, page);

    // Authority = DB poll, not「保存しました。」
    const stored = await pollProfileJaField(email, "self_pr", marker);
    expect(stored).toContain(marker);

    await page.reload({ waitUntil: "networkidle" });
    const panel2 = await openProfileCareerEditor(page);
    await expect(panel2.getByTestId("mc-self-pr-input")).toHaveValue(
      new RegExp(marker.replace(/[[\]]/g, "\\$&")),
    );

    await context.close();
  });

  test("D2 Employer Apply→Save same id + count", async ({ browser }) => {
    const { page, context, email } = await newPhase1cSignedInPage(browser, {
      name: "Diagnose D2",
    });

    const rawMarker = "【EMP-A-RAW】";
    const company = `アルファ社-${Date.now()}`;
    const id = await createEmployerAndReopen(page, {
      company,
      title: "エンジニア",
      narrative: `アルファ叙述${rawMarker}`,
    });
    const beforeCount = await countEmployers(email);
    expect(beforeCount).toBeGreaterThanOrEqual(1);

    const form = page.getByTestId("mc-employer-form");
    await expect(form.locator('input[name="id"]')).toHaveValue(id);

    await form.getByTestId("ai-refine-narrative_ja").click();
    await expect(page.getByTestId("ai-sidebar-panel")).toHaveAttribute(
      "data-open",
      "true",
    );
    await sendRefineAndWaitApply(page);
    await expect(lastRefineAssistant(page)).toContainText(REFINE_OR_MOCK());
    await applyRefineToDraft(page);

    await expect(form.getByTestId("mc-employer-narrative-input")).toContainText(
      MOCK_REFINE_PREFIX,
    );
    // Re-assert same id before Save (guard against remount / empty id).
    await expect(form.locator('input[name="id"]')).toHaveValue(id);

    await closeSidebarIfOpen(page);
    await clickExactSaveAndWaitAction(form, page);

    await pollEmployerNarrative(email, id, MOCK_REFINE_PREFIX);
    const afterCount = await countEmployers(email);
    expect(afterCount, "no ghost employer create on update Save").toBe(
      beforeCount,
    );

    // Reload + reopen same id still shows refined text.
    await page.reload({ waitUntil: "networkidle" });
    await page
      .getByTestId("mc-module-tabs")
      .getByRole("button", { name: "職歴" })
      .click();
    await page
      .locator("article.mc-card")
      .filter({ hasText: company })
      .getByRole("button", { name: "編集", exact: true })
      .click();
    const form2 = page.getByTestId("mc-employer-form");
    await expect(form2.locator('input[name="id"]')).toHaveValue(id);
    await expect(form2.getByTestId("mc-employer-narrative-input")).toContainText(
      MOCK_REFINE_PREFIX,
    );

    await context.close();
  });

  test("D3 Save selector substring pollution (documented)", async ({
    browser,
  }) => {
    const { page, context } = await newPhase1cSignedInPage(browser, {
      name: "Diagnose D3",
    });

    const panel = await openProfileCareerEditor(page);
    // Intentionally include「保存」in draft to reproduce Step 3B strict-mode
    // pollution against getByRole({ name: '保存' }) without exact:true.
    const polluted = "保存検証用の自己PRドラフト";
    await panel.getByTestId("mc-self-pr-input").fill(polluted);

    // Non-exact locator can match refine button accessible name that embeds draft.
    const loose = panel.getByRole("button", { name: "保存" });
    const exact = exactSaveButton(panel);
    await expect(exact).toHaveCount(1);

    const looseCount = await loose.count();
    // Document: if looseCount > 1, substring pollution is active (B confirmed).
    // Assertion stays: exact selector must remain unique and clickable.
    expect(
      looseCount,
      "informational: loose「保存」matches (1=ok, >1=pollution)",
    ).toBeGreaterThanOrEqual(1);
    await expect(exact).toBeVisible();
    await exact.click();

    await context.close();
  });
});

/** Soft presence check until mock scheme A is restored on main. */
function REFINE_OR_MOCK(): RegExp {
  return /【修正案】|【モック応答】/;
}
