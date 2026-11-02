"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getDb } from "@/db";
import {
  createEducationEntry,
  deleteEducationEntry,
  updateEducationEntry,
} from "@/lib/data/education-entries";
import {
  createLicense,
  deleteLicense,
  updateLicense,
} from "@/lib/data/licenses";
import { getProfileByUserId, upsertProfile } from "@/lib/data/profiles";
import {
  createWorkHistoryEntry,
  deleteWorkHistoryEntry,
  updateWorkHistoryEntry,
} from "@/lib/data/work-history-entries";
import { parseDateInput, yearMonthFromInput } from "@/lib/domain/dates";
import type { LocalizedText } from "@/lib/domain/localized-text";
import {
  japaneseTextFromForm,
  optionalJapaneseFromForm,
  requireJapaneseFromForm,
} from "@/lib/domain/localized-text";
import {
  EDUCATION_EVENT_CODES,
  LICENSE_STATUSES,
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

function parseYearMonth(formData: FormData): Date {
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new Error("invalid year month");
  }
  return yearMonthFromInput(year, month);
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
    const status = z.enum(LICENSE_STATUSES).parse(
      formData.get("status")?.toString(),
    );
    const input = {
      name,
      acquiredYm: parseYearMonth(formData),
      status,
      score: formData.get("score")?.toString() || null,
      sortOrder: Number(formData.get("sortOrder") ?? 0) || 0,
    };
    const db = getDb();
    if (id) {
      await updateLicense(db, userId, id, input);
    } else {
      await createLicense(db, userId, input);
    }
    revalidatePath("/profile/licenses");
  } catch {
    /* invalid form */
  }
}

export async function deleteLicenseAction(id: string): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;
  await deleteLicense(getDb(), userId, id);
  revalidatePath("/profile/licenses");
}

export async function requireProfileAccess(): Promise<string> {
  const userId = await requireUserId();
  if (!userId) redirect("/sign-in");
  return userId;
}
