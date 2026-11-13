import type { Db } from "@/db";
import { listCareerEmployers } from "@/lib/data/career-employers";
import { listCareerProjects } from "@/lib/data/career-projects";
import { listCareerSkills } from "@/lib/data/career-skills";
import { listEducationEntries } from "@/lib/data/education-entries";
import { listLicenses } from "@/lib/data/licenses";
import { getProfileByUserId } from "@/lib/data/profiles";
import { listWorkHistoryEntries } from "@/lib/data/work-history-entries";
import {
  buildExportSnapshot,
  type ExportSnapshot,
} from "@/lib/domain/export-snapshot";
import type { LocalizedText } from "@/lib/domain/localized-text";
import type {
  EducationEventCode,
  WorkHistoryEventCode,
} from "@/lib/domain/resume-events";

/** Load My Career rows and project the locked export snapshot for one user. */
export async function loadExportSnapshotForUser(
  db: Db,
  userId: string,
  now = new Date(),
): Promise<ExportSnapshot> {
  const profile = await getProfileByUserId(db, userId);
  const educationEntries = await listEducationEntries(db, userId);
  const workEntries = await listWorkHistoryEntries(db, userId);
  const licenseEntries = await listLicenses(db, userId);
  const employers = await listCareerEmployers(db, userId);
  const projects = await listCareerProjects(db, userId);
  const skills = await listCareerSkills(db, userId);

  return buildExportSnapshot({
    now,
    profile: {
      fullName: (profile?.fullName ?? {}) as LocalizedText,
      fullNameKana: profile?.fullNameKana ?? null,
      birthDate: profile?.birthDate ?? null,
      gender: (profile?.gender ?? null) as LocalizedText | null,
      photoKey: profile?.photoKey ?? null,
      postalCode: profile?.postalCode ?? null,
      address: (profile?.address ?? null) as LocalizedText | null,
      addressKana: profile?.addressKana ?? null,
      phone: profile?.phone ?? null,
      email: profile?.email ?? null,
      selfPr: (profile?.selfPr ?? null) as LocalizedText | null,
      jobSummary: (profile?.jobSummary ?? null) as LocalizedText | null,
      strengths: profile?.strengths ?? [],
      languages: profile?.languages ?? [],
      residenceStatus: profile?.residenceStatus ?? null,
      residencePeriod: profile?.residencePeriod ?? null,
      residenceUntil: profile?.residenceUntil ?? null,
      salaryAnnualMan: profile?.salaryAnnualMan ?? null,
      salaryBonusMan: profile?.salaryBonusMan ?? null,
      salaryMonthlyMan: profile?.salaryMonthlyMan ?? null,
      salaryOvertimeMan: profile?.salaryOvertimeMan ?? null,
      salaryHope: profile?.salaryHope ?? null,
      personalHope: (profile?.personalHope ?? null) as LocalizedText | null,
    },
    education: educationEntries.map((e) => ({
      yearMonth: e.yearMonth,
      school: e.school as LocalizedText,
      eventCode: e.eventCode as EducationEventCode,
    })),
    workHistory: workEntries.map((e) => ({
      yearMonth: e.yearMonth,
      company: e.company as LocalizedText,
      eventCode: e.eventCode as WorkHistoryEventCode,
    })),
    licenses: licenseEntries.map((e) => ({
      acquiredYm: e.acquiredYm,
      name: e.name as LocalizedText,
    })),
    employers: employers.map((e) => ({
      companyName: e.companyName as LocalizedText,
      title: e.title,
      startYm: e.startYm,
      endYm: e.endYm,
      capitalText: e.capitalText,
      revenueText: e.revenueText,
      employeesText: e.employeesText,
      narrative: e.narrative as LocalizedText | null,
    })),
    projects: projects.map((p) => ({
      title: p.title as LocalizedText,
      titleUrl: p.titleUrl,
      startYm: p.startYm,
      endYm: p.endYm,
      overview: p.overview as LocalizedText | null,
      phases: p.phases as LocalizedText | null,
      responsibilities: p.responsibilities as LocalizedText | null,
      results: p.results as LocalizedText | null,
      environment: p.environment,
      roleText: p.roleText,
      scaleText: p.scaleText,
      teamSizeText: p.teamSizeText,
      status: p.status,
    })),
    skills: skills.map((s) => ({
      category: s.category,
      name: s.name,
      yearsText: s.yearsText,
      description: s.description,
    })),
  });
}

export type ExportDocKind = "rirekisho" | "shokumu";
export type ExportFormat = "docx" | "pdf";

export function exportFilename(doc: ExportDocKind, format: ExportFormat): string {
  const base = doc === "rirekisho" ? "履歴書" : "職務経歴書";
  return `${base}.${format}`;
}
