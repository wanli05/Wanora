import { randomUUID } from "node:crypto";
import {
  expect,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

export const localeCookie = {
  name: "NEXT_LOCALE",
  value: "ja",
  domain: "localhost",
  path: "/",
  sameSite: "Lax" as const,
};

export function uniqueE2eEmail(label: string): string {
  return `a8-${label}-${randomUUID()}@example.test`;
}

export const E2E_PASSWORD = "correct-horse-battery";

function authOrigin(): string {
  return process.env.AUTH_URL ?? `http://localhost:${process.env.PORT ?? "3000"}`;
}

async function postAuth(
  request: APIRequestContext,
  path: string,
  body: Record<string, string>,
) {
  const res = await request.post(`/api/auth${path}`, {
    data: body,
    headers: {
      "content-type": "application/json",
      origin: authOrigin(),
    },
  });
  return res;
}

/** Create a disposable user (API). Retries briefly on 429. */
export async function apiSignUp(
  request: APIRequestContext,
  opts?: { name?: string; email?: string },
): Promise<{ email: string; password: string; name: string }> {
  const email = opts?.email ?? uniqueE2eEmail("user");
  const name = opts?.name ?? "A8 E2E User";
  let lastStatus = 0;
  let lastBody = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await postAuth(request, "/sign-up/email", {
      email,
      password: E2E_PASSWORD,
      name,
    });
    if (res.ok()) return { email, password: E2E_PASSWORD, name };
    lastStatus = res.status();
    lastBody = await res.text();
    if (lastStatus !== 429) break;
    await new Promise((r) => setTimeout(r, 1_000 * (attempt + 1)));
  }
  throw new Error(`sign-up failed: ${lastStatus} ${lastBody}`);
}

export async function apiSignIn(
  request: APIRequestContext,
  email: string,
  password: string = E2E_PASSWORD,
) {
  let lastStatus = 0;
  let lastBody = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await postAuth(request, "/sign-in/email", { email, password });
    if (res.ok()) return;
    lastStatus = res.status();
    lastBody = await res.text();
    if (lastStatus !== 429) break;
    await new Promise((r) => setTimeout(r, 1_000 * (attempt + 1)));
  }
  expect(false, `sign-in failed: ${lastStatus} ${lastBody}`).toBe(true);
}

/** Sign up once, then open a browser context already authenticated. */
export async function newSignedInPage(
  browser: Browser,
  creds: { email: string; password: string },
): Promise<{ page: Page; context: BrowserContext }> {
  const context = await browser.newContext();
  await context.addCookies([localeCookie]);
  await apiSignIn(context.request, creds.email, creds.password);
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByTestId("signed-in-as")).toBeVisible();
  return { page, context };
}

export async function openAiSidebar(page: Page) {
  const toggle = page.getByTestId("ai-sidebar-toggle");
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.getByTestId("ai-sidebar-panel")).toHaveAttribute(
    "data-open",
    "true",
  );
  await expect(
    page.getByRole("heading", { name: "AI アシスタント" }),
  ).toBeVisible();
}

export async function closeAiSidebar(page: Page) {
  await page.getByTestId("ai-sidebar-close").click();
  await expect(page.getByTestId("ai-sidebar-panel")).toHaveAttribute(
    "data-open",
    "false",
  );
}

/** Send composer text and wait until an assistant bubble contains the mock marker. */
export async function sendAiMessageAndWaitForMockReply(
  page: Page,
  content: string,
) {
  const input = page.getByTestId("ai-composer-input");
  await expect(input).toBeEnabled();
  await input.fill(content);
  await page.getByTestId("ai-composer-send").click();

  const snippet = content.trim().slice(0, 80);
  const expected = `【モック応答】ご入力を受け取りました：${snippet}`;

  await expect(
    page.getByTestId("ai-msg-user").filter({ hasText: content }),
  ).toBeVisible({ timeout: 30_000 });

  await expect(
    page.getByTestId("ai-msg-assistant").filter({ hasText: expected }),
  ).toBeVisible({ timeout: 60_000 });
}

export async function expectAiStatus(
  request: APIRequestContext,
  enabled: boolean,
) {
  const res = await request.get("/api/ai/status");
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { enabled: boolean; provider: string };
  expect(body.enabled).toBe(enabled);
  expect(body.provider).toBe("mock");
}
