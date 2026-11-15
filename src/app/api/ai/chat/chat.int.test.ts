import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as getMe } from "@/app/api/me/route";
import * as conversationsApi from "@/app/api/ai/conversations/route";
import * as conversationItemApi from "@/app/api/ai/conversations/[id]/route";
import { POST as chatPost } from "@/app/api/ai/chat/route";
import { getDb } from "@/db";
import { aiMessages, aiUsageEvents } from "@/db/schema";
import { createMockAiProvider } from "@/lib/ai/providers/mock";
import { runMockChat } from "@/lib/ai/chat/service";
import { upsertProfile } from "@/lib/data/profiles";
import { resetServerEnvCache } from "@/lib/env";
import {
  BASE_URL,
  signUp,
  uniqueEmail,
} from "../../../../../test/integration/http";

function req(
  path: string,
  init: { method?: string; cookie?: string; body?: unknown } = {},
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
  return ((await res.json()) as { id: string }).id;
}

async function createConversation(cookie: string, title = "chat") {
  const res = await conversationsApi.POST(
    req("/api/ai/conversations", { cookie, body: { title } }),
  );
  expect(res.status).toBe(201);
  return ((await res.json()) as { conversation: { id: string } }).conversation
    .id;
}

function setAiEnv(overrides: Record<string, string> = {}) {
  process.env.AI_ENABLED = "true";
  process.env.AI_PROVIDER = "mock";
  process.env.AI_RATE_LIMIT_PER_MINUTE = "50";
  process.env.AI_DAILY_TOKEN_BUDGET = "100000";
  process.env.AI_DAILY_COST_BUDGET_USD = "5";
  process.env.AI_GLOBAL_DAILY_COST_BUDGET_USD = "50";
  Object.assign(process.env, overrides);
  resetServerEnvCache();
}

beforeEach(() => {
  setAiEnv();
});

afterEach(() => {
  delete process.env.AI_ENABLED;
  delete process.env.AI_RATE_LIMIT_PER_MINUTE;
  delete process.env.AI_DAILY_TOKEN_BUDGET;
  delete process.env.AI_DAILY_COST_BUDGET_USD;
  delete process.env.AI_GLOBAL_DAILY_COST_BUDGET_USD;
  resetServerEnvCache();
});

describe("POST /api/ai/chat", () => {
  it("requires authentication", async () => {
    const res = await chatPost(
      req("/api/ai/chat", {
        body: {
          conversationId: randomUUID(),
          message: "hi",
          clientMessageId: "c1",
        },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("completes a mock turn with career context and persists both messages", async () => {
    const { cookie } = await signUp(uniqueEmail("chat-ok"));
    const userId = await sessionUserId(cookie);
    await upsertProfile(getDb(), userId, {
      fullName: { ja: "山田" },
      selfPr: { ja: "自己PR" },
      phone: "090-9999-8888",
      email: "hide@example.test",
    });
    const conversationId = await createConversation(cookie);

    const res = await chatPost(
      req("/api/ai/chat", {
        cookie,
        body: {
          conversationId,
          message: "自己PRを短くして",
          clientMessageId: randomUUID(),
          pageContext: { path: "/career", area: "my_career" },
          targetContext: { type: "profile", section: "self_pr" },
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages.user.content).toBe("自己PRを短くして");
    expect(body.messages.assistant.content).toContain("【モック応答】");
    expect(body.usage.provider).toBe("mock");
    expect(JSON.stringify(body)).not.toContain("090-9999-8888");
    expect(JSON.stringify(body)).not.toContain("hide@example.test");

    const rows = await getDb()
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId));
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.role).sort()).toEqual(["assistant", "user"]);
  });

  it("returns 404 for other users and deleted conversations", async () => {
    const a = await signUp(uniqueEmail("chat-a"));
    const b = await signUp(uniqueEmail("chat-b"));
    const conversationId = await createConversation(a.cookie);

    const cross = await chatPost(
      req("/api/ai/chat", {
        cookie: b.cookie,
        body: {
          conversationId,
          message: "intrusion",
          clientMessageId: randomUUID(),
        },
      }),
    );
    expect(cross.status).toBe(404);

    await conversationItemApi.DELETE(
      req(`/api/ai/conversations/${conversationId}`, {
        method: "DELETE",
        cookie: a.cookie,
      }),
      { params: params(conversationId) },
    );
    const deleted = await chatPost(
      req("/api/ai/chat", {
        cookie: a.cookie,
        body: {
          conversationId,
          message: "after delete",
          clientMessageId: randomUUID(),
        },
      }),
    );
    expect(deleted.status).toBe(404);
  });

  it("rejects archived conversations", async () => {
    const { cookie } = await signUp(uniqueEmail("chat-arch"));
    const conversationId = await createConversation(cookie);
    await conversationItemApi.PATCH(
      req(`/api/ai/conversations/${conversationId}`, {
        method: "PATCH",
        cookie,
        body: { status: "archived" },
      }),
      { params: params(conversationId) },
    );

    const res = await chatPost(
      req("/api/ai/chat", {
        cookie,
        body: {
          conversationId,
          message: "still?",
          clientMessageId: randomUUID(),
        },
      }),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("conversation_archived");
  });

  it("is idempotent for the same clientMessageId", async () => {
    const { cookie } = await signUp(uniqueEmail("chat-idem"));
    const conversationId = await createConversation(cookie);
    const clientMessageId = randomUUID();
    const payload = {
      conversationId,
      message: "冪等テスト",
      clientMessageId,
      pageContext: { path: "/career", area: "my_career" as const },
    };

    const first = await chatPost(
      req("/api/ai/chat", { cookie, body: payload }),
    );
    const second = await chatPost(
      req("/api/ai/chat", { cookie, body: payload }),
    );
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const a = await first.json();
    const b = await second.json();
    expect(b.replayed).toBe(true);
    expect(b.messages.user.id).toBe(a.messages.user.id);
    expect(b.messages.assistant.id).toBe(a.messages.assistant.id);

    const rows = await getDb()
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId));
    expect(rows).toHaveLength(2);

    const usage = await getDb()
      .select()
      .from(aiUsageEvents)
      .where(
        and(
          eq(aiUsageEvents.requestId, `chat:${clientMessageId}`),
          eq(aiUsageEvents.status, "ok"),
        ),
      );
    expect(usage).toHaveLength(1);
  });

  it("handles concurrent duplicate clientMessageId safely", async () => {
    const { cookie } = await signUp(uniqueEmail("chat-race"));
    const userId = await sessionUserId(cookie);
    const conversationId = await createConversation(cookie);
    const clientMessageId = randomUUID();

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        runMockChat(getDb(), {
          userId,
          conversationId,
          message: "concurrent",
          clientMessageId,
          pageContext: { path: "/career", area: "my_career" },
        }),
      ),
    );

    expect(results.every((r) => r.ok)).toBe(true);
    const ids = new Set(
      results
        .filter((r) => r.ok)
        .map((r) => (r.ok ? r.assistantMessage.id : "")),
    );
    expect(ids.size).toBe(1);

    const rows = await getDb()
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId));
    expect(rows).toHaveLength(2);
  });

  it("returns budget_exceeded without writing messages", async () => {
    setAiEnv({ AI_DAILY_COST_BUDGET_USD: "0.00001" });
    const { cookie } = await signUp(uniqueEmail("chat-budget"));
    const conversationId = await createConversation(cookie);

    const res = await chatPost(
      req("/api/ai/chat", {
        cookie,
        body: {
          conversationId,
          message: "予算超過テスト用の長い入力です。".repeat(8),
          clientMessageId: randomUUID(),
          pageContext: { path: "/career", area: "my_career" },
        },
      }),
    );
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("budget_exceeded");

    const rows = await getDb()
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId));
    expect(rows).toHaveLength(0);
  });

  it("keeps messages empty on provider failure and allows safe retry", async () => {
    const { cookie } = await signUp(uniqueEmail("chat-fail"));
    const userId = await sessionUserId(cookie);
    const conversationId = await createConversation(cookie);
    const clientMessageId = randomUUID();

    let blows = 0;
    const flaky = {
      id: "mock",
      async complete() {
        blows += 1;
        if (blows === 1) throw new Error("boom");
        return createMockAiProvider().complete({
          feature: "chat",
          messages: [{ role: "user", content: "retry" }],
        });
      },
    };

    const failed = await runMockChat(getDb(), {
      userId,
      conversationId,
      message: "fail then retry",
      clientMessageId,
      pageContext: { path: "/career", area: "my_career" },
      provider: flaky,
    });
    expect(failed.ok).toBe(false);
    if (failed.ok) return;
    expect(failed.code).toBe("provider_error");

    const mid = await getDb()
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId));
    expect(mid).toHaveLength(0);

    const retried = await runMockChat(getDb(), {
      userId,
      conversationId,
      message: "fail then retry",
      clientMessageId,
      pageContext: { path: "/career", area: "my_career" },
      provider: flaky,
    });
    expect(retried.ok).toBe(true);

    const finalRows = await getDb()
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId));
    expect(finalRows).toHaveLength(2);
  });

  it("does not let pageContext override an existing pinned target", async () => {
    const { cookie } = await signUp(uniqueEmail("chat-target"));
    const userId = await sessionUserId(cookie);
    const conversationId = await createConversation(cookie);

    await runMockChat(getDb(), {
      userId,
      conversationId,
      message: "pin target",
      clientMessageId: randomUUID(),
      pageContext: { path: "/career", area: "my_career" },
      targetContext: { type: "profile", section: "self_pr" },
    });

    const second = await runMockChat(getDb(), {
      userId,
      conversationId,
      message: "page only",
      clientMessageId: randomUUID(),
      pageContext: { path: "/board", area: "board" },
      // no targetContext — pinned self_pr must remain
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.conversation.pinnedTarget).toEqual({
      type: "profile",
      section: "self_pr",
    });
    expect(second.userMessage.pageContext).toEqual({
      path: "/board",
      area: "board",
    });
    expect(second.userMessage.targetContext).toEqual({
      type: "profile",
      section: "self_pr",
    });
  });

  it("rejects invalid bodies", async () => {
    const { cookie } = await signUp(uniqueEmail("chat-bad"));
    const conversationId = await createConversation(cookie);
    const res = await chatPost(
      req("/api/ai/chat", {
        cookie,
        body: {
          conversationId,
          message: "",
          clientMessageId: "x",
        },
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_body");
  });

  it("returns ai_unavailable when AI is disabled", async () => {
    setAiEnv({ AI_ENABLED: "false" });
    const { cookie } = await signUp(uniqueEmail("chat-off"));
    const conversationId = await createConversation(cookie);
    const res = await chatPost(
      req("/api/ai/chat", {
        cookie,
        body: {
          conversationId,
          message: "hello",
          clientMessageId: randomUUID(),
        },
      }),
    );
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("ai_unavailable");
  });
});
