/**
 * Phase 1C-QA Playwright helpers.
 *
 * Step 3B fixes baked in:
 * - Save button: exact name match (avoid substring hit on AI refine when draft
 *   contains「保存」)
 * - Persistence authority: DB poll + reload — never toast-only「保存しました。」
 * - Employer/Project: close editor after create; reopen and assert hidden id
 * - Assistant refine bubbles: scope to current job via `.last()`
 * - Markers avoid the substring「保存」
 */
import { randomUUID } from "node:crypto";
import pg from "pg";
import {
  expect,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";
import {
  apiSignIn,
  apiSignUp,
  closeAiSidebar,
  E2E_PASSWORD,
  localeCookie,
  uniqueE2eEmail,
} from "../ai-helpers";

export { apiSignIn, apiSignUp, closeAiSidebar, E2E_PASSWORD, localeCookie };
export { openAiSidebar } from "../ai-helpers";

export const MOCK_REFINE_PREFIX = "（モック修正案）";
/** Matches unlabeled 【修正案】 and labeled 【修正案:fieldId】. */
export const REFINE_MARKER = "【修正案";

export function phase1cEmail(label: string): string {
  return uniqueE2eEmail(`p1c-${label}`);
}

export async function newPhase1cSignedInPage(
  browser: Browser,
  opts?: { name?: string; email?: string },
): Promise<{
  page: Page;
  context: BrowserContext;
  email: string;
  password: string;
}> {
  const bootstrap = await browser.newContext();
  const creds = await apiSignUp(bootstrap.request, {
    name: opts?.name ?? "Phase1C QA",
    email: opts?.email ?? phase1cEmail("user"),
  });
  await bootstrap.close();

  const context = await browser.newContext();
  // Match cookie domain to BASE_URL/AUTH_URL host (runner uses localhost:3100).
  const base =
    process.env.BASE_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    "http://localhost:3100";
  const host = new URL(base).hostname;
  await context.addCookies([
    {
      ...localeCookie,
      domain: host,
    },
  ]);
  await apiSignIn(context.request, creds.email, creds.password);
  const page = await context.newPage();
  await page.goto("/profile");
  await expect(page.getByTestId("signed-in-as")).toBeVisible();
  return { page, context, email: creds.email, password: creds.password };
}

/** Exact「保存」submit — never substring-match refine buttons. */
export function exactSaveButton(scope: Page | Locator): Locator {
  return scope.getByRole("button", { name: "保存", exact: true });
}

/** Profile career extras panel (not resume wrap). */
export function profileEditPanel(page: Page): Locator {
  return page.locator("form.mc-edit-panel");
}

export async function openProfileCareerEditor(page: Page): Promise<Locator> {
  await page.goto("/profile");
  await expect(page.getByTestId("signed-in-as")).toBeVisible();
  // Module default is プロフィール; open career extras editor.
  const actions = page.locator(".mc-panel-actions").first();
  await actions.getByRole("button", { name: "編集", exact: true }).click();
  const panel = profileEditPanel(page);
  await expect(panel).toBeVisible();
  return panel;
}

export async function gotoCareerModule(
  page: Page,
  module: "職歴" | "プロジェクト",
): Promise<void> {
  await page.goto("/profile");
  await page.locator("aside.mc-side").getByRole("button", { name: module }).click();
}

/** Latest assistant bubble that carries a refine proposal for the current job. */
export function lastRefineAssistant(page: Page): Locator {
  return page
    .getByTestId("ai-msg-assistant")
    .filter({ hasText: REFINE_MARKER })
    .last();
}

export async function closeSidebarIfOpen(page: Page): Promise<void> {
  const panel = page.getByTestId("ai-sidebar-panel");
  if ((await panel.count()) === 0) return;
  const open = await panel.getAttribute("data-open");
  if (open === "true") {
    await closeAiSidebar(page);
  }
}

/**
 * Send refine from an already-open assist session and wait for Apply.
 * Uses `.last()` so prior assistant bubbles do not trip strict mode.
 */
export async function sendRefineAndWaitApply(page: Page): Promise<void> {
  const input = page.getByTestId("ai-composer-input");
  await expect(input).toBeEnabled({ timeout: 30_000 });
  // Prompt is prefilled by AiRefineButton; just send.
  await page.getByTestId("ai-composer-send").click();

  await expect(lastRefineAssistant(page)).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("ai-apply-to-draft")).toBeVisible({
    timeout: 30_000,
  });
}

export async function applyRefineToDraft(page: Page): Promise<void> {
  // Multi-field Apply shows one window.confirm listing fields (+ overwrite warn).
  const acceptDialog = (dialog: {
    accept: () => Promise<void>;
  }) => {
    void dialog.accept().catch(() => {
      /* already handled by another listener */
    });
  };
  page.on("dialog", acceptDialog);
  try {
    await page.getByTestId("ai-apply-to-draft").click();
    await expect(page.getByTestId("mc-ai-draft-hint")).toBeVisible({
      timeout: 15_000,
    });
  } finally {
    page.off("dialog", acceptDialog);
  }
}

/**
 * Rewrite the open assist composer so Mock emits only one labeled field pair.
 * Keeps module feature routing (job feature is session-bound, not prompt-bound).
 */
export async function rewriteComposerToSingleLabeledField(
  page: Page,
  fieldId: string,
  body: string,
): Promise<void> {
  const input = page.getByTestId("ai-composer-input");
  await expect(input).toBeEnabled({ timeout: 30_000 });
  const current = await input.inputValue();
  const intro = current.split("【添削対象:")[0]?.trim() || "添削してください。";
  const next = [
    intro,
    "",
    `【添削対象:${fieldId}】`,
    body,
    "【添削対象ここまで】",
  ].join("\n");
  await input.fill(next);
}

/** Open refine entry and wait for Apply on the latest bubble. */
export async function refineOnce(
  page: Page,
  refineTestId: string,
): Promise<void> {
  await page.getByTestId(refineTestId).click();
  await sendRefineAndWaitApply(page);
}

/** Native DOM click — AI sidebar can swallow Playwright pointer hits on nearby chrome. */
export async function domClick(
  locator: Locator,
): Promise<void> {
  await locator.evaluate((el) => {
    if (!(el instanceof HTMLElement)) {
      throw new Error("domClick target is not an HTMLElement");
    }
    el.click();
  });
}

/** Click exact Save and wait for the Next.js Server Action POST. */
export async function clickExactSaveAndWaitAction(
  scope: Page | Locator,
  page: Page,
): Promise<void> {
  const save = exactSaveButton(scope);
  await expect(save).toBeEnabled();
  const actionPromise = page.waitForRequest(
    (req) =>
      req.method() === "POST" &&
      (req.url().includes("?") || req.headers()["next-action"] != null || true),
    { timeout: 30_000 },
  );
  await save.click();
  // Best-effort: some environments expose next-action header; don't fail if
  // navigation/RSC revalidate completes first.
  await Promise.race([
    actionPromise.catch(() => undefined),
    page.waitForLoadState("networkidle").catch(() => undefined),
    page.waitForTimeout(1_500),
  ]);
}

export function databaseUrl(): string {
  const url =
    process.env.PHASE1C_QA_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "PHASE1C_QA_DATABASE_URL / DATABASE_URL missing — run via phase1c-qa-e2e-runner",
    );
  }
  if (/\/wanora(\?|$)/i.test(url) || /database=wanora/i.test(url)) {
    throw new Error("Refusing shared database name wanora in Phase1C helpers");
  }
  return url;
}

export async function withDb<T>(
  fn: (client: pg.Client) => Promise<T>,
): Promise<T> {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function userIdByEmail(email: string): Promise<string> {
  return withDb(async (client) => {
    const res = await client.query<{ id: string }>(
      `select id from users where email = $1 limit 1`,
      [email],
    );
    if (!res.rows[0]) throw new Error(`user not found for ${email}`);
    return res.rows[0].id;
  });
}

export async function pollProfileJaField(
  email: string,
  field: "self_pr" | "job_summary",
  contains: string,
  timeoutMs = 45_000,
): Promise<string> {
  const userId = await userIdByEmail(email);
  const started = Date.now();
  let last = "";
  while (Date.now() - started < timeoutMs) {
    last = await withDb(async (client) => {
      const res = await client.query<{ v: string | null }>(
        `select ${field}->>'ja' as v from profiles where user_id = $1 limit 1`,
        [userId],
      );
      return res.rows[0]?.v ?? "";
    });
    if (last.includes(contains)) return last;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(
    `pollProfileJaField timeout: expected ${field} to contain ${contains}; last=${JSON.stringify(last)}`,
  );
}

export async function readEmployerNarrative(
  email: string,
  employerId: string,
): Promise<string> {
  const userId = await userIdByEmail(email);
  return withDb(async (client) => {
    const res = await client.query<{ v: string | null }>(
      `select narrative->>'ja' as v from career_employers where user_id = $1 and id = $2`,
      [userId, employerId],
    );
    return res.rows[0]?.v ?? "";
  });
}

export async function countEmployers(email: string): Promise<number> {
  const userId = await userIdByEmail(email);
  return withDb(async (client) => {
    const res = await client.query<{ n: string }>(
      `select count(*)::text as n from career_employers where user_id = $1`,
      [userId],
    );
    return Number(res.rows[0]?.n ?? "0");
  });
}

export async function pollEmployerNarrative(
  email: string,
  employerId: string,
  contains: string,
  timeoutMs = 45_000,
): Promise<string> {
  const started = Date.now();
  let last = "";
  while (Date.now() - started < timeoutMs) {
    last = await readEmployerNarrative(email, employerId);
    if (last.includes(contains)) return last;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(
    `pollEmployerNarrative timeout id=${employerId}; expected ${contains}; last=${JSON.stringify(last)}`,
  );
}

export async function readProjectOverview(
  email: string,
  projectId: string,
): Promise<string> {
  return readProjectJaField(email, projectId, "overview");
}

export async function readProjectJaField(
  email: string,
  projectId: string,
  field: "overview" | "phases" | "responsibilities" | "results",
): Promise<string> {
  const userId = await userIdByEmail(email);
  return withDb(async (client) => {
    const res = await client.query<{ v: string | null }>(
      `select ${field}->>'ja' as v from career_projects where user_id = $1 and id = $2`,
      [userId, projectId],
    );
    return res.rows[0]?.v ?? "";
  });
}

export async function readProfileStrengthsText(email: string): Promise<string> {
  const userId = await userIdByEmail(email);
  return withDb(async (client) => {
    const res = await client.query<{ v: unknown }>(
      `select strengths as v from profiles where user_id = $1 limit 1`,
      [userId],
    );
    const raw = res.rows[0]?.v;
    if (Array.isArray(raw)) return raw.map(String).join("\n");
    return "";
  });
}

export async function readProfileJaField(
  email: string,
  field: "self_pr" | "job_summary",
): Promise<string> {
  const userId = await userIdByEmail(email);
  return withDb(async (client) => {
    const res = await client.query<{ v: string | null }>(
      `select ${field}->>'ja' as v from profiles where user_id = $1 limit 1`,
      [userId],
    );
    return res.rows[0]?.v ?? "";
  });
}

export async function countProjects(email: string): Promise<number> {
  const userId = await userIdByEmail(email);
  return withDb(async (client) => {
    const res = await client.query<{ n: string }>(
      `select count(*)::text as n from career_projects where user_id = $1`,
      [userId],
    );
    return Number(res.rows[0]?.n ?? "0");
  });
}

export async function pollProjectOverview(
  email: string,
  projectId: string,
  contains: string,
  timeoutMs = 45_000,
): Promise<string> {
  const started = Date.now();
  let last = "";
  while (Date.now() - started < timeoutMs) {
    last = await readProjectOverview(email, projectId);
    if (last.includes(contains)) return last;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(
    `pollProjectOverview timeout id=${projectId}; expected ${contains}; last=${JSON.stringify(last)}`,
  );
}

export async function countNonMockUsage(email?: string): Promise<number> {
  return withDb(async (client) => {
    if (email) {
      const userId = await userIdByEmail(email);
      const res = await client.query<{ n: string }>(
        `select count(*)::text as n from ai_usage_events where user_id = $1 and provider <> 'mock'`,
        [userId],
      );
      return Number(res.rows[0]?.n ?? "0");
    }
    const res = await client.query<{ n: string }>(
      `select count(*)::text as n from ai_usage_events where provider <> 'mock'`,
    );
    return Number(res.rows[0]?.n ?? "0");
  });
}

export async function countOpenAiJobs(): Promise<number> {
  return withDb(async (client) => {
    const res = await client.query<{ n: string }>(
      `select count(*)::text as n from ai_jobs where provider = 'openai'`,
    );
    return Number(res.rows[0]?.n ?? "0");
  });
}

/**
 * Create employer row via UI, close editor, reopen, return stable id.
 * Avoids stale「保存しました。」and empty-id create-on-save.
 */
export async function createEmployerAndReopen(
  page: Page,
  data: {
    company: string;
    title?: string;
    narrative: string;
    startYm?: string;
  },
): Promise<string> {
  await gotoCareerModule(page, "職歴");
  await page.getByRole("button", { name: "追加", exact: true }).click();
  const form = page.getByTestId("mc-employer-form");
  await expect(form).toBeVisible();
  await form.locator('input[name="companyName_ja"]').fill(data.company);
  if (data.title) {
    await form.locator('input[name="title"]').fill(data.title);
  }
  await form
    .locator('input[name="startYm"]')
    .fill(data.startYm ?? "2020-04");
  await form.getByTestId("mc-employer-narrative-input").fill(data.narrative);
  await clickExactSaveAndWaitAction(form, page);

  // Force close so create Feedback does not linger as a false success signal.
  const close = form.getByRole("button", { name: "閉じる", exact: true });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
  }
  await expect(form).toHaveCount(0, { timeout: 15_000 });

  // Reopen by company card.
  await page
    .locator("article.mc-card")
    .filter({ hasText: data.company })
    .getByRole("button", { name: "編集", exact: true })
    .click();
  await expect(page.getByTestId("mc-employer-form")).toBeVisible();
  const id = await page
    .getByTestId("mc-employer-form")
    .locator('input[name="id"]')
    .inputValue();
  expect(id, "employer id after create+reopen").toBeTruthy();
  return id;
}

export async function createProjectAndReopen(
  page: Page,
  data: {
    title: string;
    overview: string;
    startYm?: string;
  },
): Promise<string> {
  await gotoCareerModule(page, "プロジェクト");
  await page.getByRole("button", { name: "追加", exact: true }).click();
  const form = page.getByTestId("mc-project-form");
  await expect(form).toBeVisible();
  await form.locator('input[name="title_ja"]').fill(data.title);
  await form
    .locator('input[name="startYm"]')
    .fill(data.startYm ?? "2021-01");
  await form.getByTestId("mc-project-overview-input").fill(data.overview);
  await clickExactSaveAndWaitAction(form, page);

  const close = form.getByRole("button", { name: "閉じる", exact: true });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
  }
  await expect(form).toHaveCount(0, { timeout: 15_000 });

  await page
    .locator("article.mc-card")
    .filter({ hasText: data.title })
    .getByRole("button", { name: "編集", exact: true })
    .click();
  await expect(page.getByTestId("mc-project-form")).toBeVisible();
  const id = await page
    .getByTestId("mc-project-form")
    .locator('input[name="id"]')
    .inputValue();
  expect(id, "project id after create+reopen").toBeTruthy();
  return id;
}

export async function reopenEmployerByCompany(
  page: Page,
  company: string,
): Promise<Locator> {
  await gotoCareerModule(page, "職歴");
  await page
    .locator("article.mc-card")
    .filter({ hasText: company })
    .getByRole("button", { name: "編集", exact: true })
    .click();
  const form = page.getByTestId("mc-employer-form");
  await expect(form).toBeVisible();
  return form;
}

export async function reopenProjectByTitle(
  page: Page,
  title: string,
): Promise<Locator> {
  await gotoCareerModule(page, "プロジェクト");
  await page
    .locator("article.mc-card")
    .filter({ hasText: title })
    .getByRole("button", { name: "編集", exact: true })
    .click();
  const form = page.getByTestId("mc-project-form");
  await expect(form).toBeVisible();
  return form;
}

export async function expectAiStatusMock(
  request: APIRequestContext,
): Promise<void> {
  const res = await request.get("/api/ai/status");
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { enabled: boolean; provider: string };
  expect(body.enabled).toBe(true);
  expect(body.provider).toBe("mock");
}

export function uniqueMarker(prefix: string): string {
  return `【${prefix}-${randomUUID().slice(0, 8)}】`;
}
