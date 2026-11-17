import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { aiDailyBudgetCounters, users } from "@/db/schema";
import { hardDeleteUserAccount } from "@/lib/ai/jobs/purge";

export type CleanupAiTestUserResult =
  | { ok: true; userId: string; deletedBudgetRows: number }
  | { ok: false; reason: string; userId: string };

/**
 * Delete only data owned by a fiction test user created by the harness.
 *
 * Safety rails:
 * - Requires non-empty userId
 * - User must exist
 * - Email must end with `@example.test` (fiction marker used by AI int tests)
 * - Deletes only `scope_type=user` budget rows for that userId
 * - Never touches `scope_type=global` counters
 * - Never cancels or deletes jobs belonging to other users
 */
export async function cleanupAiTestUserData(
  db: Db,
  userId: string,
): Promise<CleanupAiTestUserResult> {
  const id = userId.trim();
  if (!id) {
    return { ok: false, reason: "missing_user_id", userId };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) {
    return { ok: false, reason: "user_not_found", userId: id };
  }

  if (!user.email.toLowerCase().endsWith("@example.test")) {
    return {
      ok: false,
      reason: "email_not_fiction_example_test",
      userId: id,
    };
  }

  await hardDeleteUserAccount(db, id);

  const deletedBudget = await db
    .delete(aiDailyBudgetCounters)
    .where(
      and(
        eq(aiDailyBudgetCounters.scopeType, "user"),
        eq(aiDailyBudgetCounters.scopeId, id),
      ),
    )
    .returning({ scopeId: aiDailyBudgetCounters.scopeId });

  return {
    ok: true,
    userId: id,
    deletedBudgetRows: deletedBudget.length,
  };
}
