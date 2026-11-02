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
import { upsertProfile } from "@/lib/data/profiles";
import {
  createWorkHistoryEntry,
  deleteWorkHistoryEntry,
  updateWorkHistoryEntry,
} from "@/lib/data/work-history-entries";
import { parseDateInput, yearMonthFromInput } from "@/lib/domain/dates";
import {
  localizedTextFromForm,
  parseLocalizedText,
} from "@/lib/domain/localized-text";
import {
  EDUCATION_EVENT_CODES,
  LICENSE_STATUSES,
  WORK_HISTORY_EVENT_CODES,
} from "@/lib/domain/resume-events";
import { getSessionUser } from "@/lib/session";

const dateFormatSchema = z.enum(["wareki", "seireki"]);

async function requireUserId(): Promise<string | null> {
  const user = await getSessionUser(await headers());
  return user?.id ?? null;
}

function optionalLocalizedFromForm(
  formData: FormData,
  prefix: string,
): ReturnType<typeof parseLocalizedText> | null {
  const text = localizedTextFromForm(formData, prefix);
  return Object.keys(text).length > 0 ? text : null;
}

export async function saveProfileAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;

  try {
    const fullName = localizedTextFromForm(formData, "fullName");
    if (Object.keys(fullName).length === 0) {
      return;
    }
    const birthRaw = formData.get("birthDate")?.toString();
    const dateFormat = dateFormatSchema.parse(
      formData.get("dateFormat")?.toString() ?? "wareki",
    );
    await upsertProfile(getDb(), userId, {
      fullName,
      fullNameKana: formData.get("fullNameKana")?.toString() || null,
      birthDate: birthRaw ? parseDateInput(birthRaw) : null,
      gender: optionalLocalizedFromForm(formData, "gender"),
      postalCode: formData.get("postalCode")?.toString() || null,
      address: optionalLocalizedFromForm(formData, "address"),
      addressKana: formData.get("addressKana")?.toString() || null,
      phone: formData.get("phone")?.toString() || null,
      email: formData.get("email")?.toString() || null,
      altContact: optionalLocalizedFromForm(formData, "altContact"),
      dateFormat,
    });
    revalidatePath("/profile");
  } catch {
    /* validation errors are ignored until we add form error UI */
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
    const school = localizedTextFromForm(formData, "school");
    if (Object.keys(school).length === 0) {
      return;
    }
    const eventCode = z.enum(EDUCATION_EVENT_CODES).parse(
      formData.get("eventCode")?.toString(),
    );
    const input = {
      yearMonth: parseYearMonth(formData),
      school,
      eventCode,
      note: optionalLocalizedFromForm(formData, "note"),
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
    const company = localizedTextFromForm(formData, "company");
    if (Object.keys(company).length === 0) {
      return;
    }
    const eventCode = z.enum(WORK_HISTORY_EVENT_CODES).parse(
      formData.get("eventCode")?.toString(),
    );
    const input = {
      yearMonth: parseYearMonth(formData),
      company,
      eventCode,
      note: optionalLocalizedFromForm(formData, "note"),
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
    const name = localizedTextFromForm(formData, "name");
    if (Object.keys(name).length === 0) {
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
