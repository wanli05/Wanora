import { and, desc, eq, inArray, isNotNull, lt, ne } from "drizzle-orm";
import type { Db } from "@/db";
import {
  aiConversations,
  type AiConversationStatus,
} from "@/db/schema";

export type AiConversationRow = typeof aiConversations.$inferSelect;

export async function listAiConversations(
  db: Db,
  userId: string,
  options?: { includeArchived?: boolean },
) {
  const statuses: AiConversationStatus[] = options?.includeArchived
    ? ["active", "archived"]
    : ["active"];
  return db
    .select()
    .from(aiConversations)
    .where(
      and(
        eq(aiConversations.userId, userId),
        inArray(aiConversations.status, statuses),
      ),
    )
    .orderBy(desc(aiConversations.updatedAt));
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

export async function createAiConversation(
  db: Db,
  userId: string,
  input?: { title?: string | null; pinnedTarget?: unknown },
) {
  const [row] = await db
    .insert(aiConversations)
    .values({
      userId,
      title: input?.title ?? null,
      pinnedTarget: input?.pinnedTarget ?? null,
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

/** Hard-delete soft-deleted rows older than cutoff (for external scheduler). */
export async function hardDeleteExpiredAiConversations(
  db: Db,
  cutoff: Date,
) {
  const deleted = await db
    .delete(aiConversations)
    .where(
      and(
        eq(aiConversations.status, "deleted"),
        isNotNull(aiConversations.deletedAt),
        lt(aiConversations.deletedAt, cutoff),
      ),
    )
    .returning({ id: aiConversations.id });
  return deleted.length;
}
