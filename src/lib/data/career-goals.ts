import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { careerGoals, type CareerGoalKind } from "@/db/schema";
import type { LocalizedText } from "@/lib/domain/localized-text";

export type CareerGoalRow = typeof careerGoals.$inferSelect;

export type CareerGoalInput = {
  kind: CareerGoalKind;
  content: LocalizedText;
  sortOrder?: number;
};

export async function listCareerGoals(db: Db, userId: string) {
  return db
    .select()
    .from(careerGoals)
    .where(eq(careerGoals.userId, userId))
    .orderBy(asc(careerGoals.kind), asc(careerGoals.sortOrder));
}

export async function createCareerGoal(
  db: Db,
  userId: string,
  input: CareerGoalInput,
) {
  const [row] = await db
    .insert(careerGoals)
    .values({
      userId,
      kind: input.kind,
      content: input.content,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return row;
}

export async function updateCareerGoal(
  db: Db,
  userId: string,
  id: string,
  input: CareerGoalInput,
) {
  const [row] = await db
    .update(careerGoals)
    .set({
      kind: input.kind,
      content: input.content,
      sortOrder: input.sortOrder ?? 0,
    })
    .where(and(eq(careerGoals.id, id), eq(careerGoals.userId, userId)))
    .returning();
  return row;
}

export async function deleteCareerGoal(db: Db, userId: string, id: string) {
  const deleted = await db
    .delete(careerGoals)
    .where(and(eq(careerGoals.id, id), eq(careerGoals.userId, userId)))
    .returning({ id: careerGoals.id });
  return deleted.length > 0;
}
