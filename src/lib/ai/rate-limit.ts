import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { countAiCallsSince } from "@/lib/ai/usage";

/**
 * Cross-process rate limiting via Postgres transaction advisory locks +
 * counting `ai_usage_events`. Not process-memory-only.
 *
 * Lock key is derived from userId so concurrent requests for the same user
 * serialize; different users do not block each other.
 */
export async function withUserAiLock<T>(
  db: Db,
  userId: string,
  fn: () => Promise<T>,
): Promise<T> {
  // Two-int form avoids 64-bit overflow issues with hashtext alone.
  await db.execute(
    sql`select pg_advisory_xact_lock(
      hashtext('wanora:ai:user'),
      hashtext(${userId})
    )`,
  );
  return fn();
}

export type RateLimitDecision =
  | { allowed: true; current: number; limit: number }
  | { allowed: false; current: number; limit: number };

export async function checkUserRateLimit(
  db: Db,
  userId: string,
  limitPerMinute: number,
  now = new Date(),
): Promise<RateLimitDecision> {
  const windowStart = new Date(now.getTime() - 60_000);
  const current = await countAiCallsSince(db, userId, windowStart);
  if (current >= limitPerMinute) {
    return { allowed: false, current, limit: limitPerMinute };
  }
  return { allowed: true, current, limit: limitPerMinute };
}
