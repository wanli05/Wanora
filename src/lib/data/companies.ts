import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { companies } from "@/db/schema";
import { ProgressError } from "@/lib/progress/errors";

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
