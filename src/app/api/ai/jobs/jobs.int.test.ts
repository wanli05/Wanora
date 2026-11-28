import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as getMe } from "@/app/api/me/route";
import { drainAiWorker } from "@/lib/ai/jobs/worker";
import { getDb } from "@/db";
import { getAiJobById } from "@/lib/data/ai-jobs";
import { resetServerEnvCache } from "@/lib/env";
import {
  BASE_URL,
  signUp,
  uniqueEmail,
} from "../../../../../test/integration/http";
import * as conversations from "../conversations/route";
import * as jobsCollection from "./route";
import * as jobItem from "./[id]/route";

function req(
  path: string,
  init: {
    method?: string;
    cookie?: string;
    body?: unknown;
  } = {},
) {
  const headers = new Headers();
  if (init.body !== undefined) headers.set("content-type", "application/json");
  if (init.cookie) headers.set("cookie", init.cookie);
  return new Request(`${BASE_URL}${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

const params = (id: string) => Promise.resolve({ id });

async function sessionUserId(cookie: string) {
  const res = await getMe(
    new Request(`${BASE_URL}/api/me`, { headers: { cookie } }),
  );
  const body = await res.json();
  return body.id as string;
}

function setAiEnv() {
  process.env.AI_ENABLED = "true";
  process.env.AI_PROVIDER = "mock";
  process.env.AI_RATE_LIMIT_PER_MINUTE = "50";
  process.env.AI_DAILY_TOKEN_BUDGET = "100000";
  process.env.AI_DAILY_COST_BUDGET_USD = "1";
  process.env.AI_DAILY_JOB_LIMIT = "100";
  process.env.AI_MAX_CONCURRENT_JOBS = "10";
  process.env.AI_GLOBAL_DAILY_COST_BUDGET_USD = "20";
  resetServerEnvCache();
}

beforeEach(async () => {
  setAiEnv();
  await drainAiWorker(getDb(), { workerIdPrefix: "jobs-api-cleanup" });
});

afterEach(() => {
  delete process.env.AI_ENABLED;
  delete process.env.AI_RATE_LIMIT_PER_MINUTE;
  delete process.env.AI_DAILY_TOKEN_BUDGET;
  delete process.env.AI_DAILY_COST_BUDGET_USD;
  delete process.env.AI_DAILY_JOB_LIMIT;
  delete process.env.AI_MAX_CONCURRENT_JOBS;
  delete process.env.AI_GLOBAL_DAILY_COST_BUDGET_USD;
  resetServerEnvCache();
});

describe("/api/ai/jobs", () => {
  it("requires authentication", async () => {
    expect(
      (
        await jobsCollection.POST(
          req("/api/ai/jobs", {
            body: {
              conversationId: randomUUID(),
              clientRequestId: randomUUID(),
              content: "x",
            },
          }),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await jobItem.GET(req(`/api/ai/jobs/${randomUUID()}`), {
          params: params(randomUUID()),
        })
      ).status,
    ).toBe(401);
  });

  it("enqueues, replays idempotent requests, and returns job status", async () => {
    const { cookie } = await signUp(uniqueEmail("ai-jobs"));
    const createdConv = await conversations.POST(
      req("/api/ai/conversations", {
        cookie,
        body: { title: "API job" },
      }),
    );
    expect(createdConv.status).toBe(201);
    const convBody = await createdConv.json();
    const conversationId = convBody.conversation.id as string;
    const clientRequestId = randomUUID();

    const first = await jobsCollection.POST(
      req("/api/ai/jobs", {
        cookie,
        body: {
          conversationId,
          clientRequestId,
          content: "履歴書を改善して",
          pageContext: { path: "/ja/my-career", area: "my_career" },
        },
      }),
    );
    expect(first.status).toBe(202);
    const firstBody = await first.json();
    expect(firstBody.replayed).toBe(false);
    expect(firstBody.job.status).toBe("queued");
    expect(firstBody.userMessageId).toBeTruthy();
    const jobId = firstBody.job.id as string;

    const replay = await jobsCollection.POST(
      req("/api/ai/jobs", {
        cookie,
        body: {
          conversationId,
          clientRequestId,
          content: "履歴書を改善して",
        },
      }),
    );
    expect(replay.status).toBe(200);
    const replayBody = await replay.json();
    expect(replayBody.replayed).toBe(true);
    expect(replayBody.job.id).toBe(jobId);

    const got = await jobItem.GET(req(`/api/ai/jobs/${jobId}`, { cookie }), {
      params: params(jobId),
    });
    expect(got.status).toBe(200);
    const gotBody = await got.json();
    expect(gotBody.job.id).toBe(jobId);
    expect(gotBody.job.status).toBe("queued");

    // Drain shared-DB leftovers from earlier suites, then assert our job.
    await drainAiWorker(getDb(), { workerIdPrefix: "api-test-worker" });
    const drained = await getAiJobById(getDb(), jobId);
    expect(drained?.status).toBe("succeeded");

    const after = await jobItem.GET(req(`/api/ai/jobs/${jobId}`, { cookie }), {
      params: params(jobId),
    });
    const afterBody = await after.json();
    expect(afterBody.job.status).toBe("succeeded");
    expect(afterBody.job.resultMessageId).toBeTruthy();
  });

  it("returns 404 for cross-user job access", async () => {
    const a = await signUp(uniqueEmail("ai-jobs-a"));
    const b = await signUp(uniqueEmail("ai-jobs-b"));
    const createdConv = await conversations.POST(
      req("/api/ai/conversations", {
        cookie: a.cookie,
        body: { title: "private" },
      }),
    );
    const convBody = await createdConv.json();
    const enq = await jobsCollection.POST(
      req("/api/ai/jobs", {
        cookie: a.cookie,
        body: {
          conversationId: convBody.conversation.id,
          clientRequestId: randomUUID(),
          content: "secret",
        },
      }),
    );
    const enqBody = await enq.json();
    const jobId = enqBody.job.id as string;

    const cross = await jobItem.GET(
      req(`/api/ai/jobs/${jobId}`, { cookie: b.cookie }),
      { params: params(jobId) },
    );
    expect(cross.status).toBe(404);
    const crossBody = await cross.json();
    expect(crossBody.error).toBe("not_found");

    // Ensure both users exist (sanity)
    expect(await sessionUserId(a.cookie)).not.toBe(await sessionUserId(b.cookie));
  });
});
