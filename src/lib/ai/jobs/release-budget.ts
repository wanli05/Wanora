import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { aiUsageEvents } from "@/db/schema";
import { settleBudgets } from "@/lib/ai/budget";
import { updateAiUsageEventStatus } from "@/lib/ai/usage";

/**
 * Release a still-`reserved` usage row and its budget counters.
 * No-op when usage is missing or already terminal (prevents double settle).
 */
export async function releaseReservedUsageIfNeeded(
  db: Db,
  args: {
    userId: string;
    usageEventId: string | null | undefined;
    errorCode: string;
    now?: Date;
  },
): Promise<{ released: boolean }> {
  if (!args.usageEventId) return { released: false };
  const now = args.now ?? new Date();

  const [usage] = await db
    .select()
    .from(aiUsageEvents)
    .where(
      and(
        eq(aiUsageEvents.id, args.usageEventId),
        eq(aiUsageEvents.userId, args.userId),
      ),
    )
    .limit(1);

  if (!usage || usage.status !== "reserved") {
    return { released: false };
  }

  await settleBudgets(db, {
    userId: args.userId,
    reservedUsd: usage.estimatedCostUsd,
    actualUsd: "0",
    success: false,
    now,
  });
  await updateAiUsageEventStatus(db, args.userId, usage.id, {
    status: "error",
    errorCode: args.errorCode,
    estimatedCostUsd: "0",
  });
  return { released: true };
}
