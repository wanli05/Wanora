import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { drainAiWorker } from "@/lib/ai/jobs/worker";
import { getDb } from "@/db";
import { resetServerEnvCache } from "@/lib/env";
import {
  BASE_URL,
  signUp,
  uniqueEmail,
} from "../../../../../test/integration/http";
import * as conversations from "../conversations/route";
import * as jobsCollection from "./route";
import * as jobItem from "./[id]/route";
import * as cancelRoute from "./[id]/cancel/route";
import * as purgeRoute from "../admin/purge-deleted/route";

function req(
  path: string,
  init: {
    method?: string;
    cookie?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
) {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  if (init.cookie) headers.set("cookie", init.cookie);
  return new Request(`${BASE_URL}${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

const params = (id: string) => Promise.resolve({ id });

beforeEach(async () => {
  process.env.AI_ENABLED = "true";
  process.env.AI_PROVIDER = "mock";
  process.env.AI_RATE_LIMIT_PER_MINUTE = "50";
  process.env.AI_DAILY_TOKEN_BUDGET = "100000";
  process.env.AI_DAILY_COST_BUDGET_USD = "1";
  process.env.AI_DAILY_JOB_LIMIT = "100";
  process.env.AI_MAX_CONCURRENT_JOBS = "10";
  process.env.AI_GLOBAL_DAILY_COST_BUDGET_USD = "20";
  process.env.AI_PURGE_SECRET = "test-purge-secret";
  resetServerEnvCache();
  await drainAiWorker(getDb(), { workerIdPrefix: "api-cancel-cleanup" });
});

afterEach(() => {
  delete process.env.AI_ENABLED;
  delete process.env.AI_PURGE_SECRET;
  resetServerEnvCache();
});

describe("POST /api/ai/jobs/[id]/cancel + purge admin", () => {
  it("cancels own job and 404s cross-user", async () => {
    const a = await signUp(uniqueEmail("cancel-a"));
    const b = await signUp(uniqueEmail("cancel-b"));
    const created = await conversations.POST(
      req("/api/ai/conversations", {
        cookie: a.cookie,
        body: { title: "c" },
      }),
    );
    const conv = await created.json();
    const enq = await jobsCollection.POST(
      req("/api/ai/jobs", {
        cookie: a.cookie,
        body: {
          conversationId: conv.conversation.id,
          clientRequestId: randomUUID(),
          content: "cancel me",
        },
      }),
    );
    const enqBody = await enq.json();
    const jobId = enqBody.job.id as string;

    const cross = await cancelRoute.POST(
      req(`/api/ai/jobs/${jobId}/cancel`, {
        method: "POST",
        cookie: b.cookie,
      }),
      { params: params(jobId) },
    );
    expect(cross.status).toBe(404);

    const ok = await cancelRoute.POST(
      req(`/api/ai/jobs/${jobId}/cancel`, {
        method: "POST",
        cookie: a.cookie,
      }),
      { params: params(jobId) },
    );
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.job.status).toBe("canceled");

    const again = await cancelRoute.POST(
      req(`/api/ai/jobs/${jobId}/cancel`, {
        method: "POST",
        cookie: a.cookie,
      }),
      { params: params(jobId) },
    );
    expect(again.status).toBe(200);
    const againBody = await again.json();
    expect(againBody.alreadyTerminal).toBe(true);

    const got = await jobItem.GET(
      req(`/api/ai/jobs/${jobId}`, { cookie: a.cookie }),
      { params: params(jobId) },
    );
    expect((await got.json()).job.status).toBe("canceled");
  });

  it("requires purge secret and rejects session cookies", async () => {
    const { cookie } = await signUp(uniqueEmail("purge-user"));
    const asUser = await purgeRoute.POST(
      req("/api/ai/admin/purge-deleted", {
        method: "POST",
        cookie,
      }),
    );
    expect(asUser.status).toBe(401);

    const bad = await purgeRoute.POST(
      req("/api/ai/admin/purge-deleted", {
        method: "POST",
        headers: { authorization: "Bearer wrong" },
      }),
    );
    expect(bad.status).toBe(401);

    const ok = await purgeRoute.POST(
      req("/api/ai/admin/purge-deleted", {
        method: "POST",
        headers: { authorization: "Bearer test-purge-secret" },
      }),
    );
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.ok).toBe(true);
  });
});
