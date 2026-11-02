import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { educationEntries } from "@/db/schema";
import { compareTimelineRows } from "@/lib/domain/resume-events";
import type { EducationEventCode } from "@/lib/domain/resume-events";
import type { LocalizedText } from "@/lib/domain/localized-text";

export type EducationEntryRow = typeof educationEntries.$inferSelect;

export type EducationEntryInput = {
  yearMonth: Date;
  school: LocalizedText;
  eventCode: EducationEventCode;
  note?: LocalizedText | null;
  sortOrder?: number;
};

export async function listEducationEntries(
  db: Db,
  userId: string,
): Promise<EducationEntryRow[]> {
  const rows = await db
    .select()
    .from(educationEntries)
    .where(eq(educationEntries.userId, userId))
    .orderBy(asc(educationEntries.yearMonth), asc(educationEntries.sortOrder));
  return [...rows].sort((a, b) =>
    compareTimelineRows(
      { yearMonth: a.yearMonth, sortOrder: a.sortOrder },
      { yearMonth: b.yearMonth, sortOrder: b.sortOrder },
    ),
  );
}

export async function getEducationEntry(
  db: Db,
  userId: string,
  id: string,
): Promise<EducationEntryRow | undefined> {
  const [row] = await db
    .select()
    .from(educationEntries)
    .where(
      and(eq(educationEntries.id, id), eq(educationEntries.userId, userId)),
    )
    .limit(1);
  return row;
}

export async function createEducationEntry(
  db: Db,
  userId: string,
  input: EducationEntryInput,
): Promise<EducationEntryRow> {
  const [row] = await db
    .insert(educationEntries)
    .values({
      userId,
      yearMonth: input.yearMonth,
      school: input.school,
      eventCode: input.eventCode,
      note: input.note ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return row;
}

export async function updateEducationEntry(
  db: Db,
  userId: string,
  id: string,
  input: EducationEntryInput,
): Promise<EducationEntryRow | undefined> {
  const [row] = await db
    .update(educationEntries)
    .set({
      yearMonth: input.yearMonth,
      school: input.school,
      eventCode: input.eventCode,
      note: input.note ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .where(
      and(eq(educationEntries.id, id), eq(educationEntries.userId, userId)),
    )
    .returning();
  return row;
}

export async function deleteEducationEntry(
  db: Db,
  userId: string,
  id: string,
): Promise<boolean> {
  const deleted = await db
    .delete(educationEntries)
    .where(
      and(eq(educationEntries.id, id), eq(educationEntries.userId, userId)),
    )
    .returning({ id: educationEntries.id });
  return deleted.length > 0;
}
