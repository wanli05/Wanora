import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { recruiters } from "@/db/schema";
import { ProgressError } from "@/lib/progress/errors";
import { getAccessiblePlatform } from "./platforms";

export async function listRecruiters(db: Db, userId: string) {
  return db.select().from(recruiters).where(eq(recruiters.userId, userId));
}

export async function createRecruiter(
  db: Db,
  userId: string,
  input: { platformId: string; name: string; agency?: string; email?: string },
) {
  const name = input.name.trim();
  if (!name) throw new ProgressError("invalid", "recruiter name required");
  await getAccessiblePlatform(db, userId, input.platformId);
  const [row] = await db
    .insert(recruiters)
    .values({
      userId,
      platformId: input.platformId,
      name,
      agency: input.agency?.trim() || null,
      email: input.email?.trim() || null,
    })
    .returning();
  return row;
}

export async function getOwnedRecruiter(db: Db, userId: string, id: string) {
  const [row] = await db
    .select()
    .from(recruiters)
    .where(and(eq(recruiters.id, id), eq(recruiters.userId, userId)));
  if (!row) throw new ProgressError("not_found", "recruiter not found");
  return row;
}
