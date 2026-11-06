import { randomUUID } from "node:crypto";
import * as authRoute from "@/app/api/auth/[...all]/route";

export const BASE_URL = "http://localhost:3000";

export function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@example.test`;
}

export function authRequest(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    cookie?: string;
    origin?: string;
  } = {},
): Request {
  const headers = new Headers({ origin: init.origin ?? BASE_URL });
  if (init.body !== undefined) headers.set("content-type", "application/json");
  if (init.cookie) headers.set("cookie", init.cookie);
  return new Request(`${BASE_URL}${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

export async function callAuth(
  path: string,
  init: Parameters<typeof authRequest>[1] = {},
): Promise<Response> {
  const req = authRequest(`/api/auth${path}`, init);
  return req.method === "GET" ? authRoute.GET(req) : authRoute.POST(req);
}

/** Turns Set-Cookie headers into a Cookie request header value. */
export function cookieFrom(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

export async function signUp(
  email: string,
  password = "correct-horse-battery",
  name = "Test User",
): Promise<{ res: Response; cookie: string }> {
  const res = await callAuth("/sign-up/email", {
    body: { email, password, name },
  });
  return { res, cookie: cookieFrom(res) };
}
