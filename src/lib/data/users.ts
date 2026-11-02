import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { users } from "@/db/schema";
import type { Locale } from "@/lib/locale";

export async function updateUiLocale(
  db: Db,
  userId: string,
  uiLocale: Locale,
): Promise<void> {
  await db.update(users).set({ uiLocale }).where(eq(users.id, userId));
}
