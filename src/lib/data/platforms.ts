import { and, eq, isNull, or } from "drizzle-orm";
import type { Db } from "@/db";
import { platforms } from "@/db/schema";
import type { PresetPlatformCode } from "@/lib/progress/enums";
import { ProgressError } from "@/lib/progress/errors";

export async function listPlatforms(db: Db, userId: string) {
  return db
    .select()
    .from(platforms)
    .where(or(isNull(platforms.userId), eq(platforms.userId, userId)));
}

export async function getAccessiblePlatform(
  db: Db,
  userId: string,
  platformId: string,
) {
  const [row] = await db
    .select()
    .from(platforms)
    .where(
      and(
        eq(platforms.id, platformId),
        or(isNull(platforms.userId), eq(platforms.userId, userId)),
      ),
    );
  if (!row) throw new ProgressError("not_found", "platform not found");
  return row;
}

export async function createCustomPlatform(
  db: Db,
  userId: string,
  name: string,
) {
  const trimmed = name.trim();
  if (!trimmed) throw new ProgressError("invalid", "platform name required");
  const [row] = await db
    .insert(platforms)
    .values({ userId, name: trimmed, code: null })
    .returning();
  return row;
}

export function platformLabel(
  row: { code: string | null; name: string | null },
  translate: (code: PresetPlatformCode) => string,
): string {
  if (row.code) return translate(row.code as PresetPlatformCode);
  return row.name ?? "";
}
