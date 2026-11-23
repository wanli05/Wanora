/**
 * Independent assist-slot conversations (My Career refine).
 * Profile uses module slot; employer/project keep record slots.
 * Requires Mock Scheme A + phase1c-qa-e2e-runner isolation.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  closeSidebarIfOpen,
  createEmployerAndReopen,
  createProjectAndReopen,
  domClick,
  MOCK_REFINE_PREFIX,
  newPhase1cSignedInPage,
  openProfileCareerEditor,
  refineOnce,
  reopenEmployerByCompany,
  sendRefineAndWaitApply,
} from "./helpers";
import { openAiSidebar } from "../ai-helpers";

const REFINE = "【修正案";

async function activeConversationId(page: Page) {
  return page
    .getByTestId("ai-sidebar-panel")
    .getAttribute("data-active-conversation-id");
}

async function assistSlotKey(page: Page) {
  return page
    .getByTestId("ai-sidebar-panel")
    .getAttribute("data-assist-slot-key");
}

async function waitAssistReady(page: Page) {
  await expect(page.getByTestId("ai-sidebar-panel")).toHaveAttribute(
    "data-assist-opening",
    "false",
    { timeout: 30_000 },
  );
}

/** Wait until Assist has switched to `slotKey` and ensure/open finished. */
async function waitAssistSlot(page: Page, slotKey: string | RegExp) {
  await expect(page.getByTestId("ai-sidebar-panel")).toHaveAttribute(
    "data-assist-slot-key",
    slotKey,
    { timeout: 30_000 },
  );
  await waitAssistReady(page);
}

test.describe("session-isolation assist slots", () => {
  test("S1/S2: profile module vs project independent; repeat restores", async ({
    browser,
  }) => {
    const { page, context } = await newPhase1cSignedInPage(browser, {
      name: "Sess S1",
    });
    const panel = await openProfileCareerEditor(page);
    await panel.getByTestId("mc-self-pr-input").fill("独立会话PR【S1】");
    await panel.getByTestId("mc-job-summary-input").fill("独立会话要約【S1】");

    await refineOnce(page, "ai-refine-profile-module");
    const a = await activeConversationId(page);
    expect(a).toBeTruthy();
    expect(await assistSlotKey(page)).toBe("refine:profile:module");

    const title = `独立PJ【S1】-${Date.now()}`;
    await closeSidebarIfOpen(page);
    const projectId = await createProjectAndReopen(page, {
      title,
      overview: "独立概要【S1】",
    });
    await refineOnce(page, "ai-refine-project-module");
    await waitAssistSlot(
      page,
      new RegExp(`^refine:career_project:${projectId}$`),
    );
    const b = await activeConversationId(page);
    expect(b).toBeTruthy();
    expect(b).not.toBe(a);

    await closeSidebarIfOpen(page);
    await page
      .getByTestId("mc-project-form")
      .getByRole("button", { name: "閉じる", exact: true })
      .click();

    const panel2 = await openProfileCareerEditor(page);
    await domClick(panel2.getByTestId("ai-refine-profile-module"));
    await waitAssistSlot(page, "refine:profile:module");
    await expect(page.getByTestId("ai-sidebar-panel")).toHaveAttribute(
      "data-active-conversation-id",
      a!,
      { timeout: 30_000 },
    );
    await expect(
      page.getByTestId("ai-msg-assistant").filter({ hasText: REFINE }),
    ).toBeVisible();

    await closeSidebarIfOpen(page);
    await context.close();
  });

  test("S3: 新規 keeps old slot conversation", async ({ browser }) => {
    const { page, context } = await newPhase1cSignedInPage(browser, {
      name: "Sess S3",
    });
    const panel = await openProfileCareerEditor(page);
    await panel.getByTestId("mc-self-pr-input").fill("新規前PR【S3】");
    await refineOnce(page, "ai-refine-profile-module");
    const first = await activeConversationId(page);
    expect(first).toBeTruthy();

    await page.getByTestId("ai-new-conversation").click();
    await expect(page.getByTestId("ai-sidebar-panel")).not.toHaveAttribute(
      "data-active-conversation-id",
      first!,
      { timeout: 30_000 },
    );
    await expect(page.getByTestId("ai-sidebar-panel")).toHaveAttribute(
      "data-assist-slot-key",
      "refine:profile:module",
    );
    const second = await activeConversationId(page);
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
    const optionValues = await page
      .locator('[data-testid="ai-conversation-select"] option')
      .evaluateAll((opts) =>
        opts.map((o) => (o as HTMLOptionElement).value).filter(Boolean),
      );
    expect(optionValues).toEqual(expect.arrayContaining([first, second]));

    await closeSidebarIfOpen(page);
    await context.close();
  });

  test("S4: employer A/B chat histories stay isolated", async ({ browser }) => {
    const { page, context } = await newPhase1cSignedInPage(browser, {
      name: "Sess S4",
    });
    const companyA = `会社A【S4】-${Date.now()}`;
    const companyB = `会社B【S4】-${Date.now()}`;
    const idA = await createEmployerAndReopen(page, {
      company: companyA,
      narrative: "叙述A【S4】",
      startYm: "2020-01",
    });
    await page
      .getByTestId("mc-employer-form")
      .getByRole("button", { name: "閉じる", exact: true })
      .click();

    const idB = await createEmployerAndReopen(page, {
      company: companyB,
      narrative: "叙述B【S4】",
      startYm: "2021-01",
    });
    expect(idA).not.toBe(idB);
    await page
      .getByTestId("mc-employer-form")
      .getByRole("button", { name: "閉じる", exact: true })
      .click();

    await reopenEmployerByCompany(page, companyA);
    await refineOnce(page, "ai-refine-narrative_ja");
    const convA = await activeConversationId(page);
    expect(convA).toBeTruthy();
    expect(await assistSlotKey(page)).toMatch(
      new RegExp(`^refine:career_employer:${idA}$`),
    );
    await expect(
      page
        .getByTestId("ai-msg-assistant")
        .filter({ hasText: MOCK_REFINE_PREFIX }),
    ).toBeVisible();

    await closeSidebarIfOpen(page);
    await page
      .getByTestId("mc-employer-form")
      .getByRole("button", { name: "閉じる", exact: true })
      .click();

    await reopenEmployerByCompany(page, companyB);
    await refineOnce(page, "ai-refine-narrative_ja");
    const convB = await activeConversationId(page);
    expect(convB).toBeTruthy();
    expect(convB).not.toBe(convA);
    expect(await assistSlotKey(page)).toMatch(
      new RegExp(`^refine:career_employer:${idB}$`),
    );

    await closeSidebarIfOpen(page);
    await context.close();
  });

  test("S5: refresh restores slot conversation; composer uses current draft", async ({
    browser,
  }) => {
    const { page, context } = await newPhase1cSignedInPage(browser, {
      name: "Sess S5",
    });
    const panel = await openProfileCareerEditor(page);
    await panel.getByTestId("mc-self-pr-input").fill("刷新前PR【S5】");
    await refineOnce(page, "ai-refine-profile-module");
    const before = await activeConversationId(page);
    expect(before).toBeTruthy();
    await closeSidebarIfOpen(page);

    await page.reload({ waitUntil: "networkidle" });
    const panel2 = await openProfileCareerEditor(page);
    await panel2.getByTestId("mc-self-pr-input").fill("刷新後ドラフト【S5】");
    await domClick(panel2.getByTestId("ai-refine-profile-module"));
    await expect(page.getByTestId("ai-sidebar-panel")).toHaveAttribute(
      "data-active-conversation-id",
      before!,
      { timeout: 30_000 },
    );
    await expect(
      page.getByTestId("ai-msg-assistant").filter({ hasText: REFINE }),
    ).toBeVisible();
    await expect(page.getByTestId("ai-composer-input")).toContainText(
      "刷新後ドラフト【S5】",
    );

    await closeSidebarIfOpen(page);
    await context.close();
  });

  test("S6: rapid profile↔employer does not cross-arm Apply", async ({
    browser,
  }) => {
    const { page, context } = await newPhase1cSignedInPage(browser, {
      name: "Sess S6",
    });
    const panel = await openProfileCareerEditor(page);
    await panel.getByTestId("mc-self-pr-input").fill("快速A【S6】");
    await refineOnce(page, "ai-refine-profile-module");
    const a = await activeConversationId(page);

    await closeSidebarIfOpen(page);
    const company = `快速会社【S6】-${Date.now()}`;
    await createEmployerAndReopen(page, {
      company,
      narrative: "快速叙述【S6】",
      startYm: "2020-01",
    });
    await domClick(page.getByTestId("ai-refine-narrative_ja"));
    await waitAssistSlot(page, /^refine:career_employer:/);
    await sendRefineAndWaitApply(page);
    const b = await activeConversationId(page);
    expect(b).not.toBe(a);
    await expect(page.getByTestId("ai-apply-to-draft")).toHaveCount(1);

    await closeSidebarIfOpen(page);
    await page
      .getByTestId("mc-employer-form")
      .getByRole("button", { name: "閉じる", exact: true })
      .click();
    const panel2 = await openProfileCareerEditor(page);
    await domClick(panel2.getByTestId("ai-refine-profile-module"));
    await waitAssistSlot(page, "refine:profile:module");
    await expect(page.getByTestId("ai-sidebar-panel")).toHaveAttribute(
      "data-active-conversation-id",
      a!,
      { timeout: 30_000 },
    );

    await closeSidebarIfOpen(page);
    await context.close();
  });

  test("S7: general AI toggle does not resume refine slot (Q7)", async ({
    browser,
  }) => {
    const { page, context } = await newPhase1cSignedInPage(browser, {
      name: "Sess S7",
    });
    const panel = await openProfileCareerEditor(page);
    await panel.getByTestId("mc-self-pr-input").fill("普通入口【S7】");
    await refineOnce(page, "ai-refine-profile-module");
    const slotted = await activeConversationId(page);
    expect(slotted).toBeTruthy();
    await closeSidebarIfOpen(page);

    await openAiSidebar(page);
    await expect(page.getByTestId("ai-sidebar-panel")).toHaveAttribute(
      "data-assist-slot-key",
      "",
    );
    const general = await activeConversationId(page);
    expect(general).not.toBe(slotted);

    await closeSidebarIfOpen(page);
    await context.close();
  });
});
