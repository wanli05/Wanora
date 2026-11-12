import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { careerEmployers } from "@/db/schema";
import type { LocalizedText } from "@/lib/domain/localized-text";

export type CareerEmployerRow = typeof careerEmployers.$inferSelect;

export type CareerEmployerInput = {
  companyName: LocalizedText;
  title?: string | null;
  startYm: Date;
  endYm?: Date | null;
  capitalText?: string | null;
  revenueText?: string | null;
  employeesText?: string | null;
  narrative?: LocalizedText | null;
  sortOrder?: number;
};

export async function listCareerEmployers(db: Db, userId: string) {
  return db
    .select()
    .from(careerEmployers)
    .where(eq(careerEmployers.userId, userId))
    .orderBy(asc(careerEmployers.sortOrder), asc(careerEmployers.startYm));
}

export async function createCareerEmployer(
  db: Db,
  userId: string,
  input: CareerEmployerInput,
) {
  const [row] = await db
    .insert(careerEmployers)
    .values({
      userId,
      companyName: input.companyName,
      title: input.title ?? null,
      startYm: input.startYm,
      endYm: input.endYm ?? null,
      capitalText: input.capitalText ?? null,
      revenueText: input.revenueText ?? null,
      employeesText: input.employeesText ?? null,
      narrative: input.narrative ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return row;
}

export async function updateCareerEmployer(
  db: Db,
  userId: string,
  id: string,
  input: CareerEmployerInput,
) {
  const [row] = await db
    .update(careerEmployers)
    .set({
      companyName: input.companyName,
      title: input.title ?? null,
      startYm: input.startYm,
      endYm: input.endYm ?? null,
      capitalText: input.capitalText ?? null,
      revenueText: input.revenueText ?? null,
      employeesText: input.employeesText ?? null,
      narrative: input.narrative ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .where(and(eq(careerEmployers.id, id), eq(careerEmployers.userId, userId)))
    .returning();
  return row;
}

export async function deleteCareerEmployer(db: Db, userId: string, id: string) {
  const deleted = await db
    .delete(careerEmployers)
    .where(and(eq(careerEmployers.id, id), eq(careerEmployers.userId, userId)))
    .returning({ id: careerEmployers.id });
  return deleted.length > 0;
}
