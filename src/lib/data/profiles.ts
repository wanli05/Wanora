import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { profiles } from "@/db/schema";
import type { DateFormatPreference } from "@/lib/domain/dates";
import type { LocalizedText } from "@/lib/domain/localized-text";

export type ProfileRow = typeof profiles.$inferSelect;

export type ProfileInput = {
  fullName: LocalizedText;
  fullNameKana?: string | null;
  birthDate?: Date | null;
  gender?: LocalizedText | null;
  postalCode?: string | null;
  address?: LocalizedText | null;
  addressKana?: string | null;
  phone?: string | null;
  email?: string | null;
  altContact?: LocalizedText | null;
  dateFormat?: DateFormatPreference;
};

export async function getProfileByUserId(
  db: Db,
  userId: string,
): Promise<ProfileRow | undefined> {
  const [row] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  return row;
}

export async function upsertProfile(
  db: Db,
  userId: string,
  input: ProfileInput,
): Promise<ProfileRow> {
  const existing = await getProfileByUserId(db, userId);
  const values = {
    fullName: input.fullName,
    fullNameKana: input.fullNameKana ?? null,
    birthDate: input.birthDate ?? null,
    gender: input.gender ?? null,
    postalCode: input.postalCode ?? null,
    address: input.address ?? null,
    addressKana: input.addressKana ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    altContact: input.altContact ?? null,
    dateFormat: input.dateFormat ?? "wareki",
  };
  if (existing) {
    const [row] = await db
      .update(profiles)
      .set(values)
      .where(and(eq(profiles.id, existing.id), eq(profiles.userId, userId)))
      .returning();
    return row;
  }
  const [row] = await db
    .insert(profiles)
    .values({ userId, ...values })
    .returning();
  return row;
}

export async function setProfilePhotoKey(
  db: Db,
  userId: string,
  photoKey: string | null,
): Promise<void> {
  const existing = await getProfileByUserId(db, userId);
  if (!existing) {
    await db.insert(profiles).values({
      userId,
      fullName: {},
      photoKey,
    });
    return;
  }
  await db
    .update(profiles)
    .set({ photoKey })
    .where(and(eq(profiles.id, existing.id), eq(profiles.userId, userId)));
}
