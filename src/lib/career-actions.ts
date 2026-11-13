"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getDb } from "@/db";
import {
  createCareerEmployer,
  deleteCareerEmployer,
  updateCareerEmployer,
} from "@/lib/data/career-employers";
import {
  createCareerGoal,
  deleteCareerGoal,
  updateCareerGoal,
} from "@/lib/data/career-goals";
import {
  createCareerProject,
  deleteCareerProject,
  updateCareerProject,
} from "@/lib/data/career-projects";
import {
  createCareerSkill,
  deleteCareerSkill,
  updateCareerSkill,
} from "@/lib/data/career-skills";
import { upsertProfile } from "@/lib/data/profiles";
import { getProfileByUserId } from "@/lib/data/profiles";
import {
  careerGoalKindSchema,
  careerProjectStatusSchema,
  isJapaneseNationality,
  parseDirectionTags,
  parseLanguages,
  parseStrengths,
} from "@/lib/domain/career";
import { parseDateInput, yearMonthFromInputValue } from "@/lib/domain/dates";
import type { LocalizedText } from "@/lib/domain/localized-text";
import { optionalJapaneseFromForm } from "@/lib/domain/localized-text";
import { getSessionUser } from "@/lib/session";

export type CareerSaveState = {
  ok?: boolean;
  error?: "unauthenticated" | "invalid" | "saveFailed";
};

async function requireUserId(): Promise<string | null> {
  const user = await getSessionUser(await headers());
  return user?.id ?? null;
}

function revalidateCareer() {
  revalidatePath("/profile", "layout");
  revalidatePath("/profile");
}

function optionalInt(raw: FormDataEntryValue | null): number | null {
  const s = raw?.toString().trim() ?? "";
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function optionalYm(raw: FormDataEntryValue | null): Date | null {
  const s = raw?.toString().trim() ?? "";
  if (!s) return null;
  return yearMonthFromInputValue(s);
}

export async function saveCareerProfileExtrasAction(
  _prev: CareerSaveState,
  formData: FormData,
): Promise<CareerSaveState> {
  const userId = await requireUserId();
  if (!userId) return { error: "unauthenticated" };
  try {
    const db = getDb();
    const existing = await getProfileByUserId(db, userId);
    const languagesRaw = formData.get("languagesJson")?.toString() ?? "[]";
    const languages = parseLanguages(JSON.parse(languagesRaw));
    const tags = parseDirectionTags(
      (formData.get("directionTags")?.toString() ?? "")
        .split(/[,、]/)
        .map((s) => s.trim()),
    );
    const strengths = parseStrengths(
      (formData.get("strengths")?.toString() ?? "")
        .split(/\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    );
    const nationality =
      formData.get("nationality")?.toString().trim() || null;
    const japanese = isJapaneseNationality(nationality);
    const residenceUntilRaw = formData.get("residenceUntil")?.toString().trim();
    await upsertProfile(db, userId, {
      fullName: (existing?.fullName as LocalizedText) ?? {},
      fullNameKana: existing?.fullNameKana,
      birthDate: existing?.birthDate,
      gender: existing?.gender as LocalizedText | null,
      postalCode: existing?.postalCode,
      address: existing?.address as LocalizedText | null,
      addressKana: existing?.addressKana,
      phone: existing?.phone,
      email: existing?.email,
      altContact: existing?.altContact as LocalizedText | null,
      dateFormat: (existing?.dateFormat as "wareki" | "seireki") ?? "wareki",
      headline: formData.get("headline")?.toString().trim() || null,
      directionTags: tags,
      selfPr: optionalJapaneseFromForm(formData, "selfPr"),
      jobSummary: optionalJapaneseFromForm(formData, "jobSummary"),
      strengths,
      languages,
      nationality,
      // 在留期間 UI 已移除：保留既有列值。日本人则清空在留資格・期限日。
      residenceStatus: japanese
        ? null
        : formData.get("residenceStatus")?.toString().trim() || null,
      residenceUntil: japanese
        ? null
        : residenceUntilRaw
          ? parseDateInput(residenceUntilRaw)
          : null,
      salaryAnnualMan: optionalInt(formData.get("salaryAnnualMan")),
      salaryMonthlyMan: optionalInt(formData.get("salaryMonthlyMan")),
      salaryHope: formData.get("salaryHope")?.toString().trim() || null,
      personalHope: optionalJapaneseFromForm(formData, "personalHope"),
    });
    revalidateCareer();
    return { ok: true };
  } catch {
    return { error: "saveFailed" };
  }
}

export async function saveCareerEmployerAction(
  _prev: CareerSaveState,
  formData: FormData,
): Promise<CareerSaveState> {
  const userId = await requireUserId();
  if (!userId) return { error: "unauthenticated" };
  try {
    const companyJa = formData.get("companyName_ja")?.toString().trim() ?? "";
    if (!companyJa) return { error: "invalid" };
    const startYm = optionalYm(formData.get("startYm"));
    if (!startYm) return { error: "invalid" };
    const input = {
      companyName: { ja: companyJa },
      title: formData.get("title")?.toString().trim() || null,
      startYm,
      endYm: optionalYm(formData.get("endYm")),
      capitalText: formData.get("capitalText")?.toString().trim() || null,
      revenueText: formData.get("revenueText")?.toString().trim() || null,
      employeesText: formData.get("employeesText")?.toString().trim() || null,
      narrative: optionalJapaneseFromForm(formData, "narrative"),
      sortOrder: optionalInt(formData.get("sortOrder")) ?? 0,
    };
    const id = formData.get("id")?.toString() || "";
    const db = getDb();
    if (id) await updateCareerEmployer(db, userId, id, input);
    else await createCareerEmployer(db, userId, input);
    revalidateCareer();
    return { ok: true };
  } catch {
    return { error: "saveFailed" };
  }
}

export async function deleteCareerEmployerAction(id: string): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;
  await deleteCareerEmployer(getDb(), userId, id);
  revalidateCareer();
}

export async function saveCareerProjectAction(
  _prev: CareerSaveState,
  formData: FormData,
): Promise<CareerSaveState> {
  const userId = await requireUserId();
  if (!userId) return { error: "unauthenticated" };
  try {
    const titleJa = formData.get("title_ja")?.toString().trim() ?? "";
    if (!titleJa) return { error: "invalid" };
    const startYm = optionalYm(formData.get("startYm"));
    if (!startYm) return { error: "invalid" };
    const status = careerProjectStatusSchema.parse(
      formData.get("status")?.toString() || "confirmed",
    );
    const input = {
      title: { ja: titleJa },
      titleUrl: formData.get("titleUrl")?.toString().trim() || null,
      startYm,
      endYm: optionalYm(formData.get("endYm")),
      overview: optionalJapaneseFromForm(formData, "overview"),
      phases: optionalJapaneseFromForm(formData, "phases"),
      responsibilities: optionalJapaneseFromForm(formData, "responsibilities"),
      results: optionalJapaneseFromForm(formData, "results"),
      environment: formData.get("environment")?.toString().trim() || null,
      roleText: formData.get("roleText")?.toString().trim() || null,
      scaleText: formData.get("scaleText")?.toString().trim() || null,
      teamSizeText: formData.get("teamSizeText")?.toString().trim() || null,
      status,
      sortOrder: optionalInt(formData.get("sortOrder")) ?? 0,
    };
    const id = formData.get("id")?.toString() || "";
    const db = getDb();
    if (id) await updateCareerProject(db, userId, id, input);
    else await createCareerProject(db, userId, input);
    revalidateCareer();
    return { ok: true };
  } catch {
    return { error: "saveFailed" };
  }
}

export async function deleteCareerProjectAction(id: string): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;
  await deleteCareerProject(getDb(), userId, id);
  revalidateCareer();
}

/** Manual structured project card; reserves pending_confirm shape (no model). */
export async function confirmPendingProjectAction(id: string): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;
  const db = getDb();
  const { listCareerProjects } = await import("@/lib/data/career-projects");
  const rows = await listCareerProjects(db, userId);
  const row = rows.find((r) => r.id === id);
  if (!row || row.status !== "pending_confirm") return;
  await updateCareerProject(db, userId, id, {
    title: row.title as LocalizedText,
    titleUrl: row.titleUrl,
    startYm: row.startYm,
    endYm: row.endYm,
    overview: row.overview as LocalizedText | null,
    phases: row.phases as LocalizedText | null,
    responsibilities: row.responsibilities as LocalizedText | null,
    results: row.results as LocalizedText | null,
    environment: row.environment,
    roleText: row.roleText,
    scaleText: row.scaleText,
    teamSizeText: row.teamSizeText,
    status: "confirmed",
    sortOrder: row.sortOrder,
  });
  revalidateCareer();
}

export async function saveCareerSkillAction(
  _prev: CareerSaveState,
  formData: FormData,
): Promise<CareerSaveState> {
  const userId = await requireUserId();
  if (!userId) return { error: "unauthenticated" };
  try {
    const category = formData.get("category")?.toString().trim() ?? "";
    const name = formData.get("name")?.toString().trim() ?? "";
    const yearsText = formData.get("yearsText")?.toString().trim() ?? "";
    if (!category || !name || !yearsText) return { error: "invalid" };
    const input = {
      category,
      name,
      yearsText,
      description: formData.get("description")?.toString().trim() || null,
      sortOrder: optionalInt(formData.get("sortOrder")) ?? 0,
    };
    const id = formData.get("id")?.toString() || "";
    const db = getDb();
    if (id) await updateCareerSkill(db, userId, id, input);
    else await createCareerSkill(db, userId, input);
    revalidateCareer();
    return { ok: true };
  } catch {
    return { error: "saveFailed" };
  }
}

export async function deleteCareerSkillAction(id: string): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;
  await deleteCareerSkill(getDb(), userId, id);
  revalidateCareer();
}

export async function saveCareerGoalAction(
  _prev: CareerSaveState,
  formData: FormData,
): Promise<CareerSaveState> {
  const userId = await requireUserId();
  if (!userId) return { error: "unauthenticated" };
  try {
    const kind = careerGoalKindSchema.parse(formData.get("kind")?.toString());
    const contentJa = formData.get("content_ja")?.toString().trim() ?? "";
    if (!contentJa) return { error: "invalid" };
    const input = {
      kind,
      content: { ja: contentJa },
      sortOrder: optionalInt(formData.get("sortOrder")) ?? 0,
    };
    const id = formData.get("id")?.toString() || "";
    const db = getDb();
    if (id) await updateCareerGoal(db, userId, id, input);
    else await createCareerGoal(db, userId, input);
    revalidateCareer();
    return { ok: true };
  } catch {
    return { error: "saveFailed" };
  }
}

export async function deleteCareerGoalAction(id: string): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;
  await deleteCareerGoal(getDb(), userId, id);
  revalidateCareer();
}
