import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { licenses } from "@/db/schema";
import type { LocalizedText } from "@/lib/domain/localized-text";

export type LicenseRow = typeof licenses.$inferSelect;

export type LicenseInput = {
  name: LocalizedText;
  acquiredYm: Date;
  sortOrder?: number;
};

export async function listLicenses(db: Db, userId: string): Promise<LicenseRow[]> {
  return db
    .select()
    .from(licenses)
    .where(eq(licenses.userId, userId))
    .orderBy(asc(licenses.acquiredYm), asc(licenses.sortOrder));
}

export async function getLicense(
  db: Db,
  userId: string,
  id: string,
): Promise<LicenseRow | undefined> {
  const [row] = await db
    .select()
    .from(licenses)
    .where(and(eq(licenses.id, id), eq(licenses.userId, userId)))
    .limit(1);
  return row;
}

export async function createLicense(
  db: Db,
  userId: string,
  input: LicenseInput,
): Promise<LicenseRow> {
  const [row] = await db
    .insert(licenses)
    .values({
      userId,
      name: input.name,
      acquiredYm: input.acquiredYm,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return row;
}

export async function updateLicense(
  db: Db,
  userId: string,
  id: string,
  input: LicenseInput,
): Promise<LicenseRow | undefined> {
  const [row] = await db
    .update(licenses)
    .set({
      name: input.name,
      acquiredYm: input.acquiredYm,
      sortOrder: input.sortOrder ?? 0,
    })
    .where(and(eq(licenses.id, id), eq(licenses.userId, userId)))
    .returning();
  return row;
}

export async function deleteLicense(
  db: Db,
  userId: string,
  id: string,
): Promise<boolean> {
  const deleted = await db
    .delete(licenses)
    .where(and(eq(licenses.id, id), eq(licenses.userId, userId)))
    .returning({ id: licenses.id });
  return deleted.length > 0;
}
