import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { GET as getMe } from "@/app/api/me/route";
import { getDb } from "@/db";
import { createAiMessage } from "@/lib/data/ai-messages";
import {
  BASE_URL,
  signUp,
  uniqueEmail,
} from "../../../../../test/integration/http";
import * as collection from "./route";
import * as item from "./[id]/route";
import * as messages from "./[id]/messages/route";

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

describe("/api/ai/conversations", () => {
  it("requires authentication", async () => {
    expect((await collection.GET(req("/api/ai/conversations"))).status).toBe(
      401,
    );
    expect(
      (await collection.POST(req("/api/ai/conversations", { body: {} }))).status,
    ).toBe(401);
    const id = randomUUID();
    expect(
      (
        await item.GET(req(`/api/ai/conversations/${id}`), {
          params: params(id),
        })
      ).status,
    ).toBe(401);
  });

  it("creates, lists, patches, archives, and soft-deletes for the session user", async () => {
    const { cookie } = await signUp(uniqueEmail("ai-conv"));

    const created = await collection.POST(
      req("/api/ai/conversations", {
        cookie,
        body: {
          title: "職務要約の相談",
          pinnedTarget: { type: "profile", section: "job_summary" },
        },
      }),
    );
    expect(created.status).toBe(201);
    const createdBody = await created.json();
    const id = createdBody.conversation.id as string;
    expect(createdBody.conversation).toMatchObject({
      title: "職務要約の相談",
      status: "active",
      pinnedTarget: { type: "profile", section: "job_summary" },
      deletedAt: null,
    });

    const listed = await collection.GET(
      req("/api/ai/conversations?limit=10&offset=0", { cookie }),
    );
    expect(listed.status).toBe(200);
    const listBody = await listed.json();
    expect(listBody.pagination).toMatchObject({
      limit: 10,
      offset: 0,
      total: 1,
    });
    expect(listBody.conversations.map((c: { id: string }) => c.id)).toContain(
      id,
    );

    const patched = await item.PATCH(
      req(`/api/ai/conversations/${id}`, {
        method: "PATCH",
        cookie,
        body: { title: "更新タイトル" },
      }),
      { params: params(id) },
    );
    expect(patched.status).toBe(200);
    expect((await patched.json()).conversation.title).toBe("更新タイトル");

    const archived = await item.PATCH(
      req(`/api/ai/conversations/${id}`, {
        method: "PATCH",
        cookie,
        body: { status: "archived" },
      }),
      { params: params(id) },
    );
    expect(archived.status).toBe(200);
    expect((await archived.json()).conversation.status).toBe("archived");

    const activeOnly = await collection.GET(
      req("/api/ai/conversations", { cookie }),
    );
    expect((await activeOnly.json()).conversations).toHaveLength(0);

    const withArchived = await collection.GET(
      req("/api/ai/conversations?includeArchived=true", { cookie }),
    );
    expect((await withArchived.json()).conversations).toHaveLength(1);

    const deleted = await item.DELETE(
      req(`/api/ai/conversations/${id}`, { method: "DELETE", cookie }),
      { params: params(id) },
    );
    expect(deleted.status).toBe(200);
    const deletedBody = await deleted.json();
    expect(deletedBody.conversation.status).toBe("deleted");
    expect(deletedBody.conversation.deletedAt).toBeTruthy();

    expect(
      (
        await item.GET(req(`/api/ai/conversations/${id}`, { cookie }), {
          params: params(id),
        })
      ).status,
    ).toBe(404);

    expect(
      (
        await item.DELETE(
          req(`/api/ai/conversations/${id}`, { method: "DELETE", cookie }),
          { params: params(id) },
        )
      ).status,
    ).toBe(404);

    expect(
      (
        await item.PATCH(
          req(`/api/ai/conversations/${id}`, {
            method: "PATCH",
            cookie,
            body: { title: "nope" },
          }),
          { params: params(id) },
        )
      ).status,
    ).toBe(404);
  });

  it("isolates conversations across users", async () => {
    const a = await signUp(uniqueEmail("ai-a"));
    const b = await signUp(uniqueEmail("ai-b"));

    const created = await collection.POST(
      req("/api/ai/conversations", {
        cookie: a.cookie,
        body: { title: "A only" },
      }),
    );
    const id = (await created.json()).conversation.id as string;

    expect(
      (
        await item.GET(req(`/api/ai/conversations/${id}`, { cookie: b.cookie }), {
          params: params(id),
        })
      ).status,
    ).toBe(404);

    expect(
      (
        await item.PATCH(
          req(`/api/ai/conversations/${id}`, {
            method: "PATCH",
            cookie: b.cookie,
            body: { title: "hijack" },
          }),
          { params: params(id) },
        )
      ).status,
    ).toBe(404);

    expect(
      (
        await item.DELETE(
          req(`/api/ai/conversations/${id}`, {
            method: "DELETE",
            cookie: b.cookie,
          }),
          { params: params(id) },
        )
      ).status,
    ).toBe(404);

    const listB = await collection.GET(
      req("/api/ai/conversations", { cookie: b.cookie }),
    );
    expect((await listB.json()).conversations).toHaveLength(0);

    expect(
      (
        await item.GET(req(`/api/ai/conversations/${id}`, { cookie: a.cookie }), {
          params: params(id),
        })
      ).status,
    ).toBe(200);
  });

  it("paginates conversations and messages", async () => {
    const { cookie } = await signUp(uniqueEmail("ai-page"));
    const userId = await sessionUserId(cookie);
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await collection.POST(
        req("/api/ai/conversations", {
          cookie,
          body: { title: `c-${i}` },
        }),
      );
      ids.push((await res.json()).conversation.id);
    }

    const page0 = await (
      await collection.GET(
        req("/api/ai/conversations?limit=2&offset=0", { cookie }),
      )
    ).json();
    expect(page0.conversations).toHaveLength(2);
    expect(page0.pagination.total).toBe(3);

    const page1 = await (
      await collection.GET(
        req("/api/ai/conversations?limit=2&offset=2", { cookie }),
      )
    ).json();
    expect(page1.conversations).toHaveLength(1);

    const conversationId = ids[0];
    const db = getDb();
    for (let i = 0; i < 5; i++) {
      await createAiMessage(db, userId, conversationId, {
        role: "user",
        content: `m-${i}`,
        clientMessageId: `client-${conversationId}-${i}`,
      });
    }

    const msgBody = await (
      await messages.GET(
        req(
          `/api/ai/conversations/${conversationId}/messages?limit=2&offset=0`,
          { cookie },
        ),
        { params: params(conversationId) },
      )
    ).json();
    expect(msgBody.messages).toHaveLength(2);
    expect(msgBody.pagination).toMatchObject({
      limit: 2,
      offset: 0,
      total: 5,
    });
    expect(msgBody.messages[0].content).toBe("m-0");
  });

  it("rejects invalid bodies and oversized queries", async () => {
    const { cookie } = await signUp(uniqueEmail("ai-bad"));

    const badTitle = await collection.POST(
      req("/api/ai/conversations", {
        cookie,
        body: { title: "x".repeat(201) },
      }),
    );
    expect(badTitle.status).toBe(400);
    expect((await badTitle.json()).error).toBe("invalid_body");

    const badQuery = await collection.GET(
      req("/api/ai/conversations?limit=999", { cookie }),
    );
    expect(badQuery.status).toBe(400);
    expect((await badQuery.json()).error).toBe("invalid_query");

    const badId = await item.GET(
      req("/api/ai/conversations/not-uuid", { cookie }),
      { params: params("not-uuid") },
    );
    expect(badId.status).toBe(400);

    const created = await collection.POST(
      req("/api/ai/conversations", { cookie, body: { title: "ok" } }),
    );
    const id = (await created.json()).conversation.id as string;
    const emptyPatch = await item.PATCH(
      req(`/api/ai/conversations/${id}`, {
        method: "PATCH",
        cookie,
        body: {},
      }),
      { params: params(id) },
    );
    expect(emptyPatch.status).toBe(400);
  });

  it("hides soft-deleted conversation messages", async () => {
    const { cookie } = await signUp(uniqueEmail("ai-msg-del"));
    const userId = await sessionUserId(cookie);
    const created = await collection.POST(
      req("/api/ai/conversations", { cookie, body: { title: "msg" } }),
    );
    const id = (await created.json()).conversation.id as string;
    await createAiMessage(getDb(), userId, id, {
      role: "user",
      content: "hello",
    });

    await item.DELETE(
      req(`/api/ai/conversations/${id}`, { method: "DELETE", cookie }),
      { params: params(id) },
    );

    expect(
      (
        await messages.GET(
          req(`/api/ai/conversations/${id}/messages`, { cookie }),
          { params: params(id) },
        )
      ).status,
    ).toBe(404);
  });
});
