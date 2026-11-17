import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { aiUsageEvents, users } from "@/db/schema";
import {
  insertAiUsageEvent,
  updateAiUsageEventStatus,
} from "@/lib/data/ai-usage";

function newUser() {
  return {
    id: randomUUID(),
    name: "Usage Schema",
    email: `${randomUUID()}@example.test`,
  };
}

describe("ai_usage_events pricing fields (migration 0014)", () => {
  it("accepts legacy inserts without new columns (defaults)", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);

    const row = await insertAiUsageEvent(db, user.id, {
      feature: "chat",
      provider: "mock",
      model: "mock-v1",
      status: "ok",
      inputTokens: 10,
      outputTokens: 5,
      estimatedCostUsd: "0.000150",
    });

    expect(row.cachedInputTokens).toBe(0);
    expect(row.reasoningTokens).toBe(0);
    expect(row.pricingVersion).toBeNull();
    expect(row.providerResponseId).toBeNull();
  });

  it("round-trips cached / reasoning / pricing_version / provider_response_id", async () => {
    const db = getDb();
    const user = newUser();
    await db.insert(users).values(user);

    const reserved = await insertAiUsageEvent(db, user.id, {
      feature: "chat",
      provider: "mock",
      model: "mock-v1",
      status: "reserved",
      estimatedCostUsd: "0.010000",
      pricingVersion: "2026-11-17",
    });

    const updated = await updateAiUsageEventStatus(db, user.id, reserved.id, {
      status: "ok",
      inputTokens: 1000,
      outputTokens: 200,
      cachedInputTokens: 100,
      reasoningTokens: 40,
      estimatedCostUsd: "0.011000",
      pricingVersion: "2026-11-17",
      providerResponseId: "resp_audit",
    });

    expect(updated?.cachedInputTokens).toBe(100);
    expect(updated?.reasoningTokens).toBe(40);
    expect(updated?.pricingVersion).toBe("2026-11-17");
    expect(updated?.providerResponseId).toBe("resp_audit");

    const [fresh] = await db
      .select()
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.id, reserved.id));
    expect(fresh.providerResponseId).toBe("resp_audit");
  });
});
