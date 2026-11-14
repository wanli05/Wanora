import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { careerSkills } from "@/db/schema";

export type CareerSkillRow = typeof careerSkills.$inferSelect;

export type CareerSkillInput = {
  category: string;
  name: string;
  yearsText: string;
  description?: string | null;
  sortOrder?: number;
};

export async function listCareerSkills(db: Db, userId: string) {
  return db
    .select()
    .from(careerSkills)
    .where(eq(careerSkills.userId, userId))
    .orderBy(asc(careerSkills.sortOrder), asc(careerSkills.category));
}

export async function createCareerSkill(
  db: Db,
  userId: string,
  input: CareerSkillInput,
) {
  const [row] = await db
    .insert(careerSkills)
    .values({
      userId,
      category: input.category,
      name: input.name,
      yearsText: input.yearsText,
      description: input.description ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return row;
}

export async function updateCareerSkill(
  db: Db,
  userId: string,
  id: string,
  input: CareerSkillInput,
) {
  const [row] = await db
    .update(careerSkills)
    .set({
      category: input.category,
      name: input.name,
      yearsText: input.yearsText,
      description: input.description ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .where(and(eq(careerSkills.id, id), eq(careerSkills.userId, userId)))
    .returning();
  return row;
}

export async function deleteCareerSkill(db: Db, userId: string, id: string) {
  const deleted = await db
    .delete(careerSkills)
    .where(and(eq(careerSkills.id, id), eq(careerSkills.userId, userId)))
    .returning({ id: careerSkills.id });
  return deleted.length > 0;
}
