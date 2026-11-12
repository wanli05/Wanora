import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { companies } from "@/db/schema";
import { ProgressError } from "@/lib/progress/errors";
import { normalizeOptionalText } from "@/lib/progress/job-posting";

export async function findOrCreateCompany(db: Db, userId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new ProgressError("invalid", "company name required");
  const [existing] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.userId, userId), eq(companies.name, trimmed)));
  if (existing) return existing;
  const [created] = await db
    .insert(companies)
    .values({ userId, name: trimmed })
    .returning();
  return created;
}

export async function updateCompanyProfile(
  db: Db,
  userId: string,
  companyId: string,
  input: { url?: string | null; notes?: string | null },
) {
  const [existing] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.userId, userId)));
  if (!existing) throw new ProgressError("not_found", "company not found");

  const patch: { url?: string | null; notes?: string | null } = {};
  if (input.url !== undefined) {
    patch.url = normalizeOptionalText(input.url);
  }
  if (input.notes !== undefined) {
    patch.notes = normalizeOptionalText(input.notes);
  }
  if (Object.keys(patch).length === 0) return existing;

  const [updated] = await db
    .update(companies)
    .set(patch)
    .where(and(eq(companies.id, companyId), eq(companies.userId, userId)))
    .returning();
  return updated;
}
