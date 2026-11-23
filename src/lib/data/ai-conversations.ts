import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  sql,
} from "drizzle-orm";
import type { Db } from "@/db";
import {
  aiConversations,
  aiJobs,
  type AiConversationStatus,
} from "@/db/schema";

export type AiConversationRow = typeof aiConversations.$inferSelect;

export type ListAiConversationsOptions = {
  /** Include archived rows. Deleted are never listed. */
  includeArchived?: boolean;
  /** Explicit status filter (non-deleted only). Overrides includeArchived when set. */
  status?: "active" | "archived";
  /**
   * When set, only conversations with this assist_slot_key.
   * When `"null"`, only legacy / general chat (`assist_slot_key IS NULL`).
   */
  assistSlotKey?: string | null;
  limit?: number;
  offset?: number;
};

function visibleStatuses(
  options?: ListAiConversationsOptions,
): AiConversationStatus[] {
  if (options?.status) return [options.status];
  return options?.includeArchived ? ["active", "archived"] : ["active"];
}

function assistSlotPredicate(assistSlotKey: string | null | undefined) {
  if (assistSlotKey === undefined) return undefined;
  if (assistSlotKey === null) return isNull(aiConversations.assistSlotKey);
  return eq(aiConversations.assistSlotKey, assistSlotKey);
}

export async function listAiConversations(
  db: Db,
  userId: string,
  options?: ListAiConversationsOptions,
) {
  const statuses = visibleStatuses(options);
  const limit = options?.limit;
  const offset = options?.offset ?? 0;
  const slotPred = assistSlotPredicate(options?.assistSlotKey);

  const query = db
    .select()
    .from(aiConversations)
    .where(
      and(
        eq(aiConversations.userId, userId),
        inArray(aiConversations.status, statuses),
        slotPred,
      ),
    )
    .orderBy(desc(aiConversations.updatedAt));

  if (limit !== undefined) {
    return query.limit(limit).offset(offset);
  }
  return query;
}

export async function countAiConversations(
  db: Db,
  userId: string,
  options?: Omit<ListAiConversationsOptions, "limit" | "offset">,
) {
  const statuses = visibleStatuses(options);
  const slotPred = assistSlotPredicate(options?.assistSlotKey);
  const [row] = await db
    .select({ n: count() })
    .from(aiConversations)
    .where(
      and(
        eq(aiConversations.userId, userId),
        inArray(aiConversations.status, statuses),
        slotPred,
      ),
    );
  return Number(row?.n ?? 0);
}

/** Latest active conversation for a refine slot (null if none). */
export async function findLatestActiveAiConversationByAssistSlot(
  db: Db,
  userId: string,
  assistSlotKey: string,
) {
  const [row] = await db
    .select()
    .from(aiConversations)
    .where(
      and(
        eq(aiConversations.userId, userId),
        eq(aiConversations.assistSlotKey, assistSlotKey),
        eq(aiConversations.status, "active"),
      ),
    )
    .orderBy(desc(aiConversations.updatedAt), desc(aiConversations.id))
    .limit(1);
  return row ?? null;
}

/** Bump updated_at so ensure-open becomes the "latest" without sending. */
export async function touchAiConversationUpdatedAt(
  db: Db,
  userId: string,
  id: string,
  now = new Date(),
) {
  const [row] = await db
    .update(aiConversations)
    .set({ updatedAt: now })
    .where(
      and(
        eq(aiConversations.id, id),
        eq(aiConversations.userId, userId),
        ne(aiConversations.status, "deleted"),
      ),
    )
    .returning();
  return row ?? null;
}

/**
 * Rebind all active conversations from a draft slot to a record slot.
 * Returns updated rows (empty when already rebound / nothing to do).
 */
export async function rebindAiConversationsAssistSlot(
  db: Db,
  userId: string,
  input: {
    fromAssistSlotKey: string;
    toAssistSlotKey: string;
    pinnedTarget: unknown;
  },
) {
  return db
    .update(aiConversations)
    .set({
      assistSlotKey: input.toAssistSlotKey,
      pinnedTarget: input.pinnedTarget,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(aiConversations.userId, userId),
        eq(aiConversations.assistSlotKey, input.fromAssistSlotKey),
        eq(aiConversations.status, "active"),
      ),
    )
    .returning();
}

/** Serialize concurrent ensure/rebind for the same user+slot. */
export async function withAssistSlotLock<T>(
  db: Db,
  userId: string,
  assistSlotKey: string,
  fn: () => Promise<T>,
): Promise<T> {
  const lockToken = `${userId}:${assistSlotKey}`;
  await db.execute(
    sql`select pg_advisory_xact_lock(
      hashtext('wanora:ai:assist-slot'),
      hashtext(${lockToken})
    )`,
  );
  return fn();
}

export async function getAiConversation(
  db: Db,
  userId: string,
  id: string,
) {
  const [row] = await db
    .select()
    .from(aiConversations)
    .where(
      and(eq(aiConversations.id, id), eq(aiConversations.userId, userId)),
    )
    .limit(1);
  return row ?? null;
}

/** Own conversation that is not soft-deleted (active or archived). */
export async function getUsableAiConversation(
  db: Db,
  userId: string,
  id: string,
) {
  const row = await getAiConversation(db, userId, id);
  if (!row || row.status === "deleted") return null;
  return row;
}

/** Own conversation that can accept new AI jobs (active only). */
export async function getActiveAiConversation(
  db: Db,
  userId: string,
  id: string,
) {
  const row = await getAiConversation(db, userId, id);
  if (!row || row.status !== "active") return null;
  return row;
}

export async function createAiConversation(
  db: Db,
  userId: string,
  input?: {
    title?: string | null;
    pinnedTarget?: unknown;
    assistSlotKey?: string | null;
  },
) {
  const [row] = await db
    .insert(aiConversations)
    .values({
      userId,
      title: input?.title ?? null,
      pinnedTarget: input?.pinnedTarget ?? null,
      assistSlotKey: input?.assistSlotKey ?? null,
      status: "active",
    })
    .returning();
  return row;
}

export async function updateAiConversation(
  db: Db,
  userId: string,
  id: string,
  patch: {
    title?: string | null;
    status?: Exclude<AiConversationStatus, "deleted">;
    pinnedTarget?: unknown;
    assistSlotKey?: string | null;
  },
) {
  const [row] = await db
    .update(aiConversations)
    .set({
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.status !== undefined
        ? { status: patch.status, deletedAt: null }
        : {}),
      ...(patch.pinnedTarget !== undefined
        ? { pinnedTarget: patch.pinnedTarget }
        : {}),
      ...(patch.assistSlotKey !== undefined
        ? { assistSlotKey: patch.assistSlotKey }
        : {}),
    })
    .where(
      and(
        eq(aiConversations.id, id),
        eq(aiConversations.userId, userId),
        ne(aiConversations.status, "deleted"),
      ),
    )
    .returning();
  return row ?? null;
}

/** Soft-delete: status=deleted and deleted_at=now(). */
export async function softDeleteAiConversation(
  db: Db,
  userId: string,
  id: string,
) {
  const [row] = await db
    .update(aiConversations)
    .set({ status: "deleted", deletedAt: new Date() })
    .where(
      and(
        eq(aiConversations.id, id),
        eq(aiConversations.userId, userId),
        ne(aiConversations.status, "deleted"),
      ),
    )
    .returning();
  return row ?? null;
}

/**
 * Hard-delete soft-deleted rows older than cutoff.
 * Prefer `purgeDeletedAiConversations` (jobs RESTRICT-safe). This helper
 * deletes jobs first so Message RESTRICT FKs cannot block conversation delete.
 */
export async function hardDeleteExpiredAiConversations(
  db: Db,
  cutoff: Date,
) {
  const expired = await db
    .select({ id: aiConversations.id })
    .from(aiConversations)
    .where(
      and(
        eq(aiConversations.status, "deleted"),
        isNotNull(aiConversations.deletedAt),
        lt(aiConversations.deletedAt, cutoff),
      ),
    );
  if (expired.length === 0) return 0;
  const ids = expired.map((r) => r.id);
  await db.delete(aiJobs).where(inArray(aiJobs.conversationId, ids));
  const deleted = await db
    .delete(aiConversations)
    .where(inArray(aiConversations.id, ids))
    .returning({ id: aiConversations.id });
  return deleted.length;
}
