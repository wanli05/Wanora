import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { GET as getMe } from "@/app/api/me/route";
import { getDb } from "@/db";
import {
  assistSlotKeyForCareerEmployer,
  assistSlotKeyForCareerEmployerDraft,
  assistSlotKeyForProfile,
  assistSlotKeyForProfileModule,
} from "@/lib/ai/conversation/assist-slot";
import { createCareerEmployer } from "@/lib/data/career-employers";
import {
  BASE_URL,
  signUp,
  uniqueEmail,
} from "../../../../../../test/integration/http";
import * as ensureRoute from "./route";
import * as rebindRoute from "../rebind-assist/route";
import * as collection from "../route";

async function sessionUserId(cookie: string) {
  const res = await getMe(
    new Request(`${BASE_URL}/api/me`, { headers: { cookie } }),
  );
  const body = await res.json();
  return body.id as string;
}

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

describe("ensure-assist / rebind-assist", () => {
  it("requires authentication", async () => {
    expect(
      (
        await ensureRoute.POST(
          req("/api/ai/conversations/ensure-assist", {
            body: {
              assistSlotKey: assistSlotKeyForProfile("self_pr"),
              pinnedTarget: { type: "profile", section: "self_pr" },
            },
          }),
        )
      ).status,
    ).toBe(401);
  });

  it("ensures once then restores the same conversation (touch updatedAt)", async () => {
    const { cookie } = await signUp(uniqueEmail("ensure-slot"));
    const slot = assistSlotKeyForProfile("self_pr");
    const body = {
      assistSlotKey: slot,
      pinnedTarget: { type: "profile", section: "self_pr" },
      title: "自己PR",
    };

    const first = await ensureRoute.POST(
      req("/api/ai/conversations/ensure-assist", { cookie, body }),
    );
    expect(first.status).toBe(200);
    const firstJson = await first.json();
    expect(firstJson.created).toBe(true);
    expect(firstJson.conversation.assistSlotKey).toBe(slot);
    const id = firstJson.conversation.id as string;

    const second = await ensureRoute.POST(
      req("/api/ai/conversations/ensure-assist", { cookie, body }),
    );
    expect(second.status).toBe(200);
    const secondJson = await second.json();
    expect(secondJson.created).toBe(false);
    expect(secondJson.conversation.id).toBe(id);
  });

  it("rejects slot/target mismatch and foreign record ids", async () => {
    const { cookie } = await signUp(uniqueEmail("ensure-bad"));
    const mismatch = await ensureRoute.POST(
      req("/api/ai/conversations/ensure-assist", {
        cookie,
        body: {
          assistSlotKey: assistSlotKeyForProfile("self_pr"),
          pinnedTarget: { type: "profile", section: "job_summary" },
        },
      }),
    );
    expect(mismatch.status).toBe(400);
    expect((await mismatch.json()).error).toBe("invalid_assist_binding");

    const missingId = randomUUID();
    const missing = await ensureRoute.POST(
      req("/api/ai/conversations/ensure-assist", {
        cookie,
        body: {
          assistSlotKey: assistSlotKeyForCareerEmployer(missingId),
          pinnedTarget: {
            type: "career_employer",
            id: missingId,
          },
        },
      }),
    );
    expect(missing.status).toBe(404);
  });

  it("dedupes concurrent ensure for the same slot", async () => {
    const { cookie } = await signUp(uniqueEmail("ensure-race"));
    const body = {
      assistSlotKey: assistSlotKeyForProfile("job_summary"),
      pinnedTarget: { type: "profile", section: "job_summary" },
    };
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        ensureRoute.POST(
          req("/api/ai/conversations/ensure-assist", { cookie, body }),
        ),
      ),
    );
    const bodies = await Promise.all(results.map((r) => r.json()));
    const ids = new Set(bodies.map((b) => b.conversation.id as string));
    expect(ids.size).toBe(1);
    expect(bodies.filter((b) => b.created === true).length).toBe(1);
  });

  it("rebinds draft→record with ownership check and is idempotent", async () => {
    const { cookie } = await signUp(uniqueEmail("rebind-slot"));
    const userId = await sessionUserId(cookie);
    const draftKey = randomUUID();
    const fromSlot = assistSlotKeyForCareerEmployerDraft(draftKey);

    const ensured = await ensureRoute.POST(
      req("/api/ai/conversations/ensure-assist", {
        cookie,
        body: { assistSlotKey: fromSlot, pinnedTarget: null, title: "draft" },
      }),
    );
    expect(ensured.status).toBe(200);
    const convId = (await ensured.json()).conversation.id as string;

    const employer = await createCareerEmployer(getDb(), userId, {
      companyName: { ja: "株式会社テスト" },
      startYm: new Date("2020-01-01T00:00:00.000Z"),
    });
    const toSlot = assistSlotKeyForCareerEmployer(employer.id);

    const foreign = await rebindRoute.POST(
      req("/api/ai/conversations/rebind-assist", {
        cookie,
        body: {
          fromAssistSlotKey: fromSlot,
          toAssistSlotKey: assistSlotKeyForCareerEmployer(randomUUID()),
          pinnedTarget: {
            type: "career_employer",
            id: randomUUID(),
          },
        },
      }),
    );
    expect([400, 404]).toContain(foreign.status);

    const rebound = await rebindRoute.POST(
      req("/api/ai/conversations/rebind-assist", {
        cookie,
        body: {
          fromAssistSlotKey: fromSlot,
          toAssistSlotKey: toSlot,
          pinnedTarget: { type: "career_employer", id: employer.id },
        },
      }),
    );
    expect(rebound.status).toBe(200);
    const reboundJson = await rebound.json();
    expect(reboundJson.reboundCount).toBe(1);
    expect(reboundJson.conversations[0].id).toBe(convId);
    expect(reboundJson.conversations[0].assistSlotKey).toBe(toSlot);

    const again = await rebindRoute.POST(
      req("/api/ai/conversations/rebind-assist", {
        cookie,
        body: {
          fromAssistSlotKey: fromSlot,
          toAssistSlotKey: toSlot,
          pinnedTarget: { type: "career_employer", id: employer.id },
        },
      }),
    );
    expect(again.status).toBe(200);
    const againJson = await again.json();
    expect(againJson.alreadyBound).toBe(true);
    expect(againJson.reboundCount).toBe(0);
  });

  it("lists by assistSlotKey and unslotted without breaking legacy create", async () => {
    const { cookie } = await signUp(uniqueEmail("list-slot"));
    await collection.POST(
      req("/api/ai/conversations", {
        cookie,
        body: { title: "legacy" },
      }),
    );
    await ensureRoute.POST(
      req("/api/ai/conversations/ensure-assist", {
        cookie,
        body: {
          assistSlotKey: assistSlotKeyForProfile("self_pr"),
          pinnedTarget: { type: "profile", section: "self_pr" },
        },
      }),
    );

    const slotted = await collection.GET(
      req(
        `/api/ai/conversations?assistSlotKey=${encodeURIComponent(
          assistSlotKeyForProfile("self_pr"),
        )}`,
        { cookie },
      ),
    );
    expect(slotted.status).toBe(200);
    const slottedBody = await slotted.json();
    expect(slottedBody.conversations).toHaveLength(1);
    expect(slottedBody.conversations[0].assistSlotKey).toBe(
      assistSlotKeyForProfile("self_pr"),
    );

    const unslotted = await collection.GET(
      req("/api/ai/conversations?unslotted=true", { cookie }),
    );
    expect(unslotted.status).toBe(200);
    const unslottedBody = await unslotted.json();
    expect(
      unslottedBody.conversations.every(
        (c: { assistSlotKey: string | null }) => c.assistSlotKey === null,
      ),
    ).toBe(true);
    expect(unslottedBody.conversations.length).toBeGreaterThanOrEqual(1);
  });

  it("ensures refine:profile:module with section module (I1)", async () => {
    const { cookie } = await signUp(uniqueEmail("ensure-module"));
    const slot = assistSlotKeyForProfileModule();
    const ok = await ensureRoute.POST(
      req("/api/ai/conversations/ensure-assist", {
        cookie,
        body: {
          assistSlotKey: slot,
          pinnedTarget: { type: "profile", section: "module" },
          title: "プロフィール 添削",
        },
      }),
    );
    expect(ok.status).toBe(200);
    const json = await ok.json();
    expect(json.conversation.assistSlotKey).toBe("refine:profile:module");
  });

  it("rejects module slot with self_pr target (I2)", async () => {
    const { cookie } = await signUp(uniqueEmail("ensure-module-bad"));
    const bad = await ensureRoute.POST(
      req("/api/ai/conversations/ensure-assist", {
        cookie,
        body: {
          assistSlotKey: assistSlotKeyForProfileModule(),
          pinnedTarget: { type: "profile", section: "self_pr" },
        },
      }),
    );
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe("invalid_assist_binding");
  });

  it("keeps legacy self_pr ensure working alongside module (I3)", async () => {
    const { cookie } = await signUp(uniqueEmail("ensure-legacy-ok"));
    const legacy = await ensureRoute.POST(
      req("/api/ai/conversations/ensure-assist", {
        cookie,
        body: {
          assistSlotKey: assistSlotKeyForProfile("self_pr"),
          pinnedTarget: { type: "profile", section: "self_pr" },
        },
      }),
    );
    const moduleEnsure = await ensureRoute.POST(
      req("/api/ai/conversations/ensure-assist", {
        cookie,
        body: {
          assistSlotKey: assistSlotKeyForProfileModule(),
          pinnedTarget: { type: "profile", section: "module" },
        },
      }),
    );
    expect(legacy.status).toBe(200);
    expect(moduleEnsure.status).toBe(200);
    const legacyId = (await legacy.json()).conversation.id;
    const moduleId = (await moduleEnsure.json()).conversation.id;
    expect(legacyId).not.toBe(moduleId);
  });
});
