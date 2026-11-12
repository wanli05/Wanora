import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { profiles } from "@/db/schema";
import type { CareerLanguage } from "@/lib/domain/career";
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
  headline?: string | null;
  directionTags?: string[];
  selfPr?: LocalizedText | null;
  jobSummary?: LocalizedText | null;
  strengths?: string[];
  languages?: CareerLanguage[];
  residenceStatus?: string | null;
  residencePeriod?: string | null;
  residenceUntil?: Date | null;
  salaryAnnualMan?: number | null;
  salaryBonusMan?: number | null;
  salaryMonthlyMan?: number | null;
  salaryOvertimeMan?: number | null;
  salaryHope?: string | null;
  personalHope?: LocalizedText | null;
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

function mergeProfileValues(input: ProfileInput, existing?: ProfileRow) {
  return {
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
    headline: input.headline !== undefined ? input.headline : (existing?.headline ?? null),
    directionTags:
      input.directionTags !== undefined
        ? input.directionTags
        : (existing?.directionTags ?? []),
    selfPr: input.selfPr !== undefined ? input.selfPr : (existing?.selfPr ?? null),
    jobSummary:
      input.jobSummary !== undefined ? input.jobSummary : (existing?.jobSummary ?? null),
    strengths:
      input.strengths !== undefined ? input.strengths : (existing?.strengths ?? []),
    languages:
      input.languages !== undefined ? input.languages : (existing?.languages ?? []),
    residenceStatus:
      input.residenceStatus !== undefined
        ? input.residenceStatus
        : (existing?.residenceStatus ?? null),
    residencePeriod:
      input.residencePeriod !== undefined
        ? input.residencePeriod
        : (existing?.residencePeriod ?? null),
    residenceUntil:
      input.residenceUntil !== undefined
        ? input.residenceUntil
        : (existing?.residenceUntil ?? null),
    salaryAnnualMan:
      input.salaryAnnualMan !== undefined
        ? input.salaryAnnualMan
        : (existing?.salaryAnnualMan ?? null),
    salaryBonusMan:
      input.salaryBonusMan !== undefined
        ? input.salaryBonusMan
        : (existing?.salaryBonusMan ?? null),
    salaryMonthlyMan:
      input.salaryMonthlyMan !== undefined
        ? input.salaryMonthlyMan
        : (existing?.salaryMonthlyMan ?? null),
    salaryOvertimeMan:
      input.salaryOvertimeMan !== undefined
        ? input.salaryOvertimeMan
        : (existing?.salaryOvertimeMan ?? null),
    salaryHope:
      input.salaryHope !== undefined ? input.salaryHope : (existing?.salaryHope ?? null),
    personalHope:
      input.personalHope !== undefined
        ? input.personalHope
        : (existing?.personalHope ?? null),
  };
}

export async function upsertProfile(
  db: Db,
  userId: string,
  input: ProfileInput,
): Promise<ProfileRow> {
  const existing = await getProfileByUserId(db, userId);
  const values = mergeProfileValues(input, existing);
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
