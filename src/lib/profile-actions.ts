"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getDb } from "@/db";
import {
  createEducationEntry,
  deleteEducationEntry,
  listEducationEntries,
  updateEducationEntry,
} from "@/lib/data/education-entries";
import {
  createLicense,
  deleteLicense,
  listLicenses,
  updateLicense,
} from "@/lib/data/licenses";
import { getProfileByUserId, upsertProfile } from "@/lib/data/profiles";
import {
  createWorkHistoryEntry,
  deleteWorkHistoryEntry,
  updateWorkHistoryEntry,
} from "@/lib/data/work-history-entries";
import { parseDateInput, yearMonthFromInputValue, compareYearMonthDates } from "@/lib/domain/dates";
import type { LocalizedText } from "@/lib/domain/localized-text";
import {
  japaneseTextFromForm,
  optionalJapaneseFromForm,
  requireJapaneseFromForm,
} from "@/lib/domain/localized-text";
import {
  EDUCATION_EVENT_CODES,
  WORK_HISTORY_EVENT_CODES,
} from "@/lib/domain/resume-events";
import { getSessionUser } from "@/lib/session";

const dateFormatSchema = z.enum(["wareki", "seireki"]);
const optionalEmailSchema = z.union([z.literal(""), z.string().email()]);

export type ProfileSaveError =
  | "unauthenticated"
  | "fullNameRequired"
  | "invalidEmail"
  | "invalidDateFormat"
  | "saveFailed";

export type ProfileSaveState = {
  ok?: boolean;
  error?: ProfileSaveError;
};

async function requireUserId(): Promise<string | null> {
  const user = await getSessionUser(await headers());
  return user?.id ?? null;
}

function resolveFullNameForSave(
  formData: FormData,
  existing: LocalizedText | undefined,
): LocalizedText | null {
  const incoming = japaneseTextFromForm(formData, "fullName");
  if (incoming.ja) return { ja: incoming.ja };
  if (existing?.ja) return { ja: existing.ja };
  return null;
}

export async function saveProfileAction(
  _prev: ProfileSaveState,
  formData: FormData,
): Promise<ProfileSaveState> {
  const userId = await requireUserId();
  if (!userId) return { error: "unauthenticated" };

  try {
    const db = getDb();
    const existing = await getProfileByUserId(db, userId);
    const fullName = resolveFullNameForSave(
      formData,
      existing?.fullName as LocalizedText | undefined,
    );
    if (!fullName) {
      return { error: "fullNameRequired" };
    }

    const emailRaw = formData.get("email")?.toString().trim() ?? "";
    const emailParsed = optionalEmailSchema.safeParse(emailRaw);
    if (!emailParsed.success) {
      return { error: "invalidEmail" };
    }

    const birthRaw = formData.get("birthDate")?.toString();
    const dateFormat = dateFormatSchema.parse(
      formData.get("dateFormat")?.toString() ?? "wareki",
    );

    await upsertProfile(db, userId, {
      fullName,
      fullNameKana: formData.get("fullNameKana")?.toString().trim() || null,
      birthDate: birthRaw ? parseDateInput(birthRaw) : null,
      gender: optionalJapaneseFromForm(formData, "gender"),
      postalCode: formData.get("postalCode")?.toString().trim() || null,
      address: optionalJapaneseFromForm(formData, "address"),
      addressKana: formData.get("addressKana")?.toString().trim() || null,
      phone: formData.get("phone")?.toString().trim() || null,
      email: emailParsed.data || null,
      altContact: optionalJapaneseFromForm(formData, "altContact"),
      dateFormat,
    });
    revalidatePath("/profile", "layout");
    revalidatePath("/profile");
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { error: "invalidDateFormat" };
    }
    return { error: "saveFailed" };
  }
}

function indexedFormKeys(formData: FormData, prefix: string): number[] {
  const indices = new Set<number>();
  const pattern = new RegExp(`^${prefix}\\.(\\d+)\\.`);
  for (const key of formData.keys()) {
    const match = key.match(pattern);
    if (match) indices.add(Number(match[1]));
  }
  return [...indices].sort((a, b) => a - b);
}

function jaFromIndexedField(
  formData: FormData,
  prefix: string,
  index: number,
  field: string,
): string {
  return formData.get(`${prefix}.${index}.${field}_ja`)?.toString().trim() ?? "";
}

function yearMonthFromIndexedForm(
  formData: FormData,
  prefix: string,
  index: number,
): Date {
  const raw = formData.get(`${prefix}.${index}.yearMonth`)?.toString();
  if (!raw) {
    throw new Error("missing year month");
  }
  return yearMonthFromInputValue(raw);
}

function sortIndexedRowsByYearMonth<T extends { formIndex: number; yearMonth: Date }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const byDate = compareYearMonthDates(a.yearMonth, b.yearMonth);
    if (byDate !== 0) return byDate;
    return a.formIndex - b.formIndex;
  });
}

async function syncEducationFromForm(
  db: ReturnType<typeof getDb>,
  userId: string,
  formData: FormData,
): Promise<void> {
  const existing = await listEducationEntries(db, userId);
  const existingIds = new Set(existing.map((e) => e.id));
  const keptIds = new Set<string>();

  const parsed = [];
  for (const i of indexedFormKeys(formData, "education")) {
    const id = formData.get(`education.${i}.id`)?.toString() || undefined;
    const schoolJa = jaFromIndexedField(formData, "education", i, "school");
    if (!schoolJa) continue;
    const eventCode = z.enum(EDUCATION_EVENT_CODES).parse(
      formData.get(`education.${i}.eventCode`)?.toString(),
    );
    parsed.push({
      formIndex: i,
      id,
      yearMonth: yearMonthFromIndexedForm(formData, "education", i),
      schoolJa,
      eventCode,
    });
  }

  for (const [sortOrder, row] of sortIndexedRowsByYearMonth(parsed).entries()) {
    const input = {
      yearMonth: row.yearMonth,
      school: { ja: row.schoolJa },
      eventCode: row.eventCode,
      note: null,
      sortOrder,
    };
    if (row.id && existingIds.has(row.id)) {
      await updateEducationEntry(db, userId, row.id, input);
      keptIds.add(row.id);
    } else {
      const created = await createEducationEntry(db, userId, input);
      keptIds.add(created.id);
    }
  }

  for (const row of existing) {
    if (!keptIds.has(row.id)) {
      await deleteEducationEntry(db, userId, row.id);
    }
  }
}

async function syncLicensesFromForm(
  db: ReturnType<typeof getDb>,
  userId: string,
  formData: FormData,
): Promise<void> {
  const existing = await listLicenses(db, userId);
  const existingIds = new Set(existing.map((e) => e.id));
  const keptIds = new Set<string>();

  const parsed = [];
  for (const i of indexedFormKeys(formData, "licenses")) {
    const id = formData.get(`licenses.${i}.id`)?.toString() || undefined;
    const nameJa = jaFromIndexedField(formData, "licenses", i, "name");
    if (!nameJa) continue;
    parsed.push({
      formIndex: i,
      id,
      yearMonth: yearMonthFromIndexedForm(formData, "licenses", i),
      nameJa,
    });
  }

  for (const [sortOrder, row] of sortIndexedRowsByYearMonth(parsed).entries()) {
    const input = {
      acquiredYm: row.yearMonth,
      name: { ja: row.nameJa },
      sortOrder,
    };
    if (row.id && existingIds.has(row.id)) {
      await updateLicense(db, userId, row.id, input);
      keptIds.add(row.id);
    } else {
      const created = await createLicense(db, userId, input);
      keptIds.add(created.id);
    }
  }

  for (const row of existing) {
    if (!keptIds.has(row.id)) {
      await deleteLicense(db, userId, row.id);
    }
  }
}

/** Saves basic profile plus education, work history, and licenses from one form submit. */
export async function saveFullProfileAction(
  _prev: ProfileSaveState,
  formData: FormData,
): Promise<ProfileSaveState> {
  const basic = await saveProfileAction(_prev, formData);
  if (!basic.ok) return basic;

  const userId = await requireUserId();
  if (!userId) return { error: "unauthenticated" };

  try {
    const db = getDb();
    await syncEducationFromForm(db, userId, formData);
    // 職歴は Work History（career_employers）が唯一編集源。履歴書フォームでは同期しない。
    // 免許・資格の編集源はスキルモジュール；履歴書フォームは omitLicenses でスキップ。
    if (formData.get("omitLicenses") !== "1") {
      await syncLicensesFromForm(db, userId, formData);
    }
    revalidatePath("/profile", "layout");
    revalidatePath("/profile");
    revalidatePath("/profile/education");
    revalidatePath("/profile/work-history");
    revalidatePath("/profile/licenses");
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { error: "invalidDateFormat" };
    }
    return { error: "saveFailed" };
  }
}

function parseYearMonth(formData: FormData): Date {
  const raw = formData.get("yearMonth")?.toString();
  if (!raw) {
    throw new Error("missing year month");
  }
  return yearMonthFromInputValue(raw);
}

export async function saveEducationEntryAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;
  const id = formData.get("id")?.toString();
  try {
    const school = requireJapaneseFromForm(formData, "school");
    if (!school) {
      return;
    }
    const eventCode = z.enum(EDUCATION_EVENT_CODES).parse(
      formData.get("eventCode")?.toString(),
    );
    const input = {
      yearMonth: parseYearMonth(formData),
      school,
      eventCode,
      note: optionalJapaneseFromForm(formData, "note"),
      sortOrder: Number(formData.get("sortOrder") ?? 0) || 0,
    };
    const db = getDb();
    if (id) {
      await updateEducationEntry(db, userId, id, input);
    } else {
      await createEducationEntry(db, userId, input);
    }
    revalidatePath("/profile/education");
  } catch {
    /* invalid form */
  }
}

export async function deleteEducationEntryAction(id: string): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;
  await deleteEducationEntry(getDb(), userId, id);
  revalidatePath("/profile/education");
}

export async function saveWorkHistoryEntryAction(
  formData: FormData,
): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;
  const id = formData.get("id")?.toString();
  try {
    const company = requireJapaneseFromForm(formData, "company");
    if (!company) {
      return;
    }
    const eventCode = z.enum(WORK_HISTORY_EVENT_CODES).parse(
      formData.get("eventCode")?.toString(),
    );
    const input = {
      yearMonth: parseYearMonth(formData),
      company,
      eventCode,
      note: optionalJapaneseFromForm(formData, "note"),
      sortOrder: Number(formData.get("sortOrder") ?? 0) || 0,
    };
    const db = getDb();
    if (id) {
      await updateWorkHistoryEntry(db, userId, id, input);
    } else {
      await createWorkHistoryEntry(db, userId, input);
    }
    revalidatePath("/profile/work-history");
  } catch {
    /* invalid form */
  }
}

export async function deleteWorkHistoryEntryAction(id: string): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;
  await deleteWorkHistoryEntry(getDb(), userId, id);
  revalidatePath("/profile/work-history");
}

export async function saveLicenseAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;
  const id = formData.get("id")?.toString();
  try {
    const name = requireJapaneseFromForm(formData, "name");
    if (!name) {
      return;
    }
    const input = {
      name,
      acquiredYm: parseYearMonth(formData),
      sortOrder: Number(formData.get("sortOrder") ?? 0) || 0,
    };
    const db = getDb();
    if (id) {
      await updateLicense(db, userId, id, input);
    } else {
      await createLicense(db, userId, input);
    }
    revalidatePath("/profile", "layout");
    revalidatePath("/profile");
    revalidatePath("/profile/licenses");
  } catch {
    /* invalid form */
  }
}

export async function deleteLicenseAction(id: string): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;
  await deleteLicense(getDb(), userId, id);
  revalidatePath("/profile", "layout");
  revalidatePath("/profile");
  revalidatePath("/profile/licenses");
}

export async function requireProfileAccess(): Promise<string> {
  const userId = await requireUserId();
  if (!userId) redirect("/sign-in");
  return userId;
}
