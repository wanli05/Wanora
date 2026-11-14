import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import {
  careerProjects,
  type CareerProjectStatus,
} from "@/db/schema";
import type { LocalizedText } from "@/lib/domain/localized-text";

export type CareerProjectRow = typeof careerProjects.$inferSelect;

export type CareerProjectInput = {
  title: LocalizedText;
  titleUrl?: string | null;
  startYm: Date;
  endYm?: Date | null;
  overview?: LocalizedText | null;
  phases?: LocalizedText | null;
  responsibilities?: LocalizedText | null;
  results?: LocalizedText | null;
  environment?: string | null;
  roleText?: string | null;
  scaleText?: string | null;
  teamSizeText?: string | null;
  status?: CareerProjectStatus;
  sortOrder?: number;
};

export async function listCareerProjects(db: Db, userId: string) {
  return db
    .select()
    .from(careerProjects)
    .where(eq(careerProjects.userId, userId))
    .orderBy(asc(careerProjects.sortOrder), asc(careerProjects.startYm));
}

export async function listConfirmedCareerProjects(db: Db, userId: string) {
  const rows = await listCareerProjects(db, userId);
  return rows.filter((row) => row.status === "confirmed");
}

export async function createCareerProject(
  db: Db,
  userId: string,
  input: CareerProjectInput,
) {
  const [row] = await db
    .insert(careerProjects)
    .values({
      userId,
      title: input.title,
      titleUrl: input.titleUrl ?? null,
      startYm: input.startYm,
      endYm: input.endYm ?? null,
      overview: input.overview ?? null,
      phases: input.phases ?? null,
      responsibilities: input.responsibilities ?? null,
      results: input.results ?? null,
      environment: input.environment ?? null,
      roleText: input.roleText ?? null,
      scaleText: input.scaleText ?? null,
      teamSizeText: input.teamSizeText ?? null,
      status: input.status ?? "confirmed",
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return row;
}

export async function updateCareerProject(
  db: Db,
  userId: string,
  id: string,
  input: CareerProjectInput,
) {
  const [row] = await db
    .update(careerProjects)
    .set({
      title: input.title,
      titleUrl: input.titleUrl ?? null,
      startYm: input.startYm,
      endYm: input.endYm ?? null,
      overview: input.overview ?? null,
      phases: input.phases ?? null,
      responsibilities: input.responsibilities ?? null,
      results: input.results ?? null,
      environment: input.environment ?? null,
      roleText: input.roleText ?? null,
      scaleText: input.scaleText ?? null,
      teamSizeText: input.teamSizeText ?? null,
      status: input.status ?? "confirmed",
      sortOrder: input.sortOrder ?? 0,
    })
    .where(and(eq(careerProjects.id, id), eq(careerProjects.userId, userId)))
    .returning();
  return row;
}

export async function deleteCareerProject(db: Db, userId: string, id: string) {
  const deleted = await db
    .delete(careerProjects)
    .where(and(eq(careerProjects.id, id), eq(careerProjects.userId, userId)))
    .returning({ id: careerProjects.id });
  return deleted.length > 0;
}
