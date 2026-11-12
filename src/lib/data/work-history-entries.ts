import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { workHistoryEntries } from "@/db/schema";
import { compareTimelineRows } from "@/lib/domain/resume-events";
import type { WorkHistoryEventCode } from "@/lib/domain/resume-events";
import type { LocalizedText } from "@/lib/domain/localized-text";

export type WorkHistoryEntryRow = typeof workHistoryEntries.$inferSelect;

export type WorkHistoryEntryInput = {
  yearMonth: Date;
  company: LocalizedText;
  eventCode: WorkHistoryEventCode;
  note?: LocalizedText | null;
  sortOrder?: number;
};

export async function listWorkHistoryEntries(
  db: Db,
  userId: string,
): Promise<WorkHistoryEntryRow[]> {
  const rows = await db
    .select()
    .from(workHistoryEntries)
    .where(eq(workHistoryEntries.userId, userId))
    .orderBy(
      asc(workHistoryEntries.yearMonth),
      asc(workHistoryEntries.sortOrder),
    );
  return [...rows].sort((a, b) =>
    compareTimelineRows(
      { yearMonth: a.yearMonth, sortOrder: a.sortOrder },
      { yearMonth: b.yearMonth, sortOrder: b.sortOrder },
    ),
  );
}

export async function getWorkHistoryEntry(
  db: Db,
  userId: string,
  id: string,
): Promise<WorkHistoryEntryRow | undefined> {
  const [row] = await db
    .select()
    .from(workHistoryEntries)
    .where(
      and(
        eq(workHistoryEntries.id, id),
        eq(workHistoryEntries.userId, userId),
      ),
    )
    .limit(1);
  return row;
}

export async function createWorkHistoryEntry(
  db: Db,
  userId: string,
  input: WorkHistoryEntryInput,
): Promise<WorkHistoryEntryRow> {
  const [row] = await db
    .insert(workHistoryEntries)
    .values({
      userId,
      yearMonth: input.yearMonth,
      company: input.company,
      eventCode: input.eventCode,
      note: input.note ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return row;
}

export async function updateWorkHistoryEntry(
  db: Db,
  userId: string,
  id: string,
  input: WorkHistoryEntryInput,
): Promise<WorkHistoryEntryRow | undefined> {
  const [row] = await db
    .update(workHistoryEntries)
    .set({
      yearMonth: input.yearMonth,
      company: input.company,
      eventCode: input.eventCode,
      note: input.note ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .where(
      and(
        eq(workHistoryEntries.id, id),
        eq(workHistoryEntries.userId, userId),
      ),
    )
    .returning();
  return row;
}

export async function deleteWorkHistoryEntry(
  db: Db,
  userId: string,
  id: string,
): Promise<boolean> {
  const deleted = await db
    .delete(workHistoryEntries)
    .where(
      and(
        eq(workHistoryEntries.id, id),
        eq(workHistoryEntries.userId, userId),
      ),
    )
    .returning({ id: workHistoryEntries.id });
  return deleted.length > 0;
}
