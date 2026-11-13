import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import {
  MyCareerCenter,
  type CareerExtrasInitial,
  type MyCareerLabels,
} from "@/components/my-career/my-career-center";
import type {
  ProfilePageFormLabels,
  ProfilePageInitial,
} from "@/components/profile-page-form";
import { getDb } from "@/db";
import { listCareerEmployers } from "@/lib/data/career-employers";
import { listCareerGoals } from "@/lib/data/career-goals";
import { listCareerProjects } from "@/lib/data/career-projects";
import { listCareerSkills } from "@/lib/data/career-skills";
import { listEducationEntries } from "@/lib/data/education-entries";
import { listLicenses } from "@/lib/data/licenses";
import { getProfileByUserId } from "@/lib/data/profiles";
import { listWorkHistoryEntries } from "@/lib/data/work-history-entries";
import {
  jaOf,
  parseDirectionTags,
  parseLanguages,
  parseStrengths,
} from "@/lib/domain/career";
import { buildCareerTimeline } from "@/lib/domain/career-timeline";
import {
  formatDateInputValue,
  formatYearMonthDate,
} from "@/app/[locale]/profile/form-fields";
import { formatYearMonthInputValue, fullYearsOld } from "@/lib/domain/dates";
import { buildExportSnapshot } from "@/lib/domain/export-snapshot";
import type { LocalizedText } from "@/lib/domain/localized-text";
import { localizedJa } from "@/lib/domain/profile-display";
import type { EducationEventCode } from "@/lib/domain/resume-events";
import type { WorkHistoryEventCode } from "@/lib/domain/resume-events";
import { isObjectStorageConfigured } from "@/lib/env";
import { requireProfileAccess } from "@/lib/profile-actions";

export default async function ProfilePage() {
  await connection();
  const userId = await requireProfileAccess();
  const db = getDb();
  const profile = await getProfileByUserId(db, userId);
  const educationEntries = await listEducationEntries(db, userId);
  const workEntries = await listWorkHistoryEntries(db, userId);
  const licenseEntries = await listLicenses(db, userId);
  const employers = await listCareerEmployers(db, userId);
  const projects = await listCareerProjects(db, userId);
  const skills = await listCareerSkills(db, userId);
  const goals = await listCareerGoals(db, userId);

  const tPage = await getTranslations("Profile.page");
  const tBasic = await getTranslations("Profile.basic");
  const tField = await getTranslations("Profile.japaneseField");
  const tSave = await getTranslations("Profile.saveFeedback");
  const tEducation = await getTranslations("Profile.education");
  const tWork = await getTranslations("Profile.workHistory");
  const tLicenses = await getTranslations("Profile.licenses");
  const te = await getTranslations("Profile.events.education");
  const tw = await getTranslations("Profile.events.workHistory");
  const tCareer = await getTranslations("MyCareer");

  const age =
    profile?.birthDate != null ? fullYearsOld(profile.birthDate) : null;

  const initial: ProfilePageInitial = {
    fullName: (profile?.fullName ?? {}) as LocalizedText,
    fullNameKana: profile?.fullNameKana ?? "",
    birthDate: profile?.birthDate
      ? formatDateInputValue(profile.birthDate)
      : "",
    age,
    gender: (profile?.gender ?? {}) as LocalizedText,
    postalCode: profile?.postalCode ?? "",
    dateFormat: (profile?.dateFormat ?? "wareki") as "wareki" | "seireki",
    address: (profile?.address ?? {}) as LocalizedText,
    addressKana: profile?.addressKana ?? "",
    phone: profile?.phone ?? "",
    email: profile?.email ?? "",
    altContact: (profile?.altContact ?? {}) as LocalizedText,
    education: educationEntries.map((entry) => {
      const ym = formatYearMonthDate(entry.yearMonth);
      return {
        id: entry.id,
        yearMonth: formatYearMonthInputValue(ym.year, ym.month),
        schoolJa: localizedJa(entry.school as LocalizedText),
        eventCode: entry.eventCode as EducationEventCode,
      };
    }),
    workHistory: workEntries.map((entry) => {
      const ym = formatYearMonthDate(entry.yearMonth);
      return {
        id: entry.id,
        yearMonth: formatYearMonthInputValue(ym.year, ym.month),
        workContentJa: localizedJa(entry.company as LocalizedText),
        eventCode: entry.eventCode as WorkHistoryEventCode,
      };
    }),
    licenses: licenseEntries.map((entry) => {
      const ym = formatYearMonthDate(entry.acquiredYm);
      return {
        id: entry.id,
        yearMonth: formatYearMonthInputValue(ym.year, ym.month),
        nameJa: localizedJa(entry.name as LocalizedText),
      };
    }),
    storageReady: isObjectStorageConfigured(),
  };

  const profileLabels: ProfilePageFormLabels = {
    edit: tPage("edit"),
    save: tPage("save"),
    addRow: tPage("addRow"),
    removeRow: tPage("removeRow"),
    savedMessage: tSave("savedAll"),
    errorMessages: {
      unauthenticated: tSave("unauthenticated"),
      fullNameRequired: tSave("fullNameRequired"),
      invalidEmail: tSave("invalidEmail"),
      invalidDateFormat: tSave("invalidDateFormat"),
      saveFailed: tSave("saveFailed"),
    },
    sections: {
      basic: tPage("sections.basic"),
      education: tPage("sections.education"),
      workHistory: tPage("sections.workHistory"),
      licenses: tPage("sections.licenses"),
    },
    basic: {
      fullName: tBasic("fullName"),
      fullNameKana: tBasic("fullNameKana"),
      birthDate: tBasic("birthDate"),
      ageSuffix: age != null ? tBasic("age", { age }) : "",
      gender: tBasic("gender"),
      postalCode: tBasic("postalCode"),
      dateFormat: tBasic("dateFormat"),
      dateFormatWareki: tBasic("dateFormatWareki"),
      dateFormatSeireki: tBasic("dateFormatSeireki"),
      address: tBasic("address"),
      addressKana: tBasic("addressKana"),
      phone: tBasic("phone"),
      email: tBasic("email"),
      altContact: tBasic("altContact"),
    },
    japaneseHint: tField("hint"),
    education: {
      empty: tEducation("empty"),
      school: tEducation("school"),
      event: tEducation("event"),
      yearMonth: tEducation("yearMonth"),
    },
    workHistory: {
      empty: tWork("empty"),
      workContent: tWork("workContent"),
      event: tWork("event"),
      yearMonth: tWork("yearMonth"),
    },
    licenses: {
      empty: tLicenses("empty"),
      name: tLicenses("name"),
      yearMonth: tLicenses("yearMonth"),
    },
    events: {
      education: {
        enrolled: te("enrolled"),
        graduated: te("graduated"),
        withdrawn: te("withdrawn"),
        completed: te("completed"),
      },
      workHistory: {
        joined: tw("joined"),
        left: tw("left"),
        transferred: tw("transferred"),
      },
    },
  };

  const extras: CareerExtrasInitial = {
    headline: profile?.headline ?? "",
    directionTags: parseDirectionTags(profile?.directionTags).join("、"),
    selfPrJa: jaOf(profile?.selfPr as LocalizedText | null),
    jobSummaryJa: jaOf(profile?.jobSummary as LocalizedText | null),
    strengthsText: parseStrengths(profile?.strengths).join("\n"),
    languages: parseLanguages(profile?.languages),
    residenceStatus: profile?.residenceStatus ?? "",
    residencePeriod: profile?.residencePeriod ?? "",
    residenceUntil: profile?.residenceUntil
      ? formatDateInputValue(profile.residenceUntil)
      : "",
    salaryAnnualMan:
      profile?.salaryAnnualMan != null ? String(profile.salaryAnnualMan) : "",
    salaryBonusMan:
      profile?.salaryBonusMan != null ? String(profile.salaryBonusMan) : "",
    salaryMonthlyMan:
      profile?.salaryMonthlyMan != null ? String(profile.salaryMonthlyMan) : "",
    salaryOvertimeMan:
      profile?.salaryOvertimeMan != null
        ? String(profile.salaryOvertimeMan)
        : "",
    salaryHope: profile?.salaryHope ?? "",
    personalHopeJa: jaOf(profile?.personalHope as LocalizedText | null),
  };

  const timeline = buildCareerTimeline({
    education: educationEntries.map((e) => ({
      id: e.id,
      yearMonth: e.yearMonth,
      school: e.school as LocalizedText,
      eventCode: e.eventCode,
    })),
    workHistory: workEntries.map((e) => ({
      id: e.id,
      yearMonth: e.yearMonth,
      company: e.company as LocalizedText,
      eventCode: e.eventCode,
    })),
    licenses: licenseEntries.map((e) => ({
      id: e.id,
      acquiredYm: e.acquiredYm,
      name: e.name as LocalizedText,
    })),
    projects: projects.map((p) => ({
      id: p.id,
      startYm: p.startYm,
      title: p.title as LocalizedText,
      status: p.status,
    })),
    skills: skills.map((s) => ({
      id: s.id,
      name: s.name,
      yearsText: s.yearsText,
    })),
    goals: goals.map((g) => ({
      id: g.id,
      kind: g.kind,
      content: g.content as LocalizedText,
    })),
  });

  const exportSnapshot = buildExportSnapshot({
    profile: {
      fullName: (profile?.fullName ?? {}) as LocalizedText,
      fullNameKana: profile?.fullNameKana ?? null,
      birthDate: profile?.birthDate ?? null,
      gender: (profile?.gender ?? null) as LocalizedText | null,
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

  const careerLabels: MyCareerLabels = {
    modules: {
      profile: tCareer("modules.profile"),
      work: tCareer("modules.work"),
      projects: tCareer("modules.projects"),
      skills: tCareer("modules.skills"),
      goals: tCareer("modules.goals"),
      timeline: tCareer("modules.timeline"),
      export: tCareer("modules.export"),
    },
    save: tCareer("save"),
    add: tCareer("add"),
    remove: tCareer("remove"),
    edit: tCareer("edit"),
    cancel: tCareer("cancel"),
    saved: tCareer("saved"),
    errors: {
      unauthenticated: tCareer("errors.unauthenticated"),
      invalid: tCareer("errors.invalid"),
      saveFailed: tCareer("errors.saveFailed"),
    },
    profileBanner: tCareer("profileBanner"),
    workSub: tCareer("workSub"),
    projectsSub: tCareer("projectsSub"),
    projectsPendingHint: tCareer("projectsPendingHint"),
    confirmDraft: tCareer("confirmDraft"),
    skillsSub: tCareer("skillsSub"),
    goalsSub: tCareer("goalsSub"),
    goalShort: tCareer("goalShort"),
    goalLong: tCareer("goalLong"),
    timelineSub: tCareer("timelineSub"),
    exportSub: tCareer("exportSub"),
    exportRireki: tCareer("exportRireki"),
    exportShokumu: tCareer("exportShokumu"),
    exportPrint: tCareer("exportPrint"),
    residence: tCareer("residence"),
    salary: tCareer("salary"),
    languages: tCareer("languages"),
    titleUrl: tCareer("titleUrl"),
    pendingBadge: tCareer("pendingBadge"),
    snapshotTitle: tCareer("snapshotTitle"),
    snapProjects: tCareer("snapProjects"),
    snapSkills: tCareer("snapSkills"),
    snapHope: tCareer("snapHope"),
    recentTitle: tCareer("recentTitle"),
    recentSub: tCareer("recentSub"),
    resumeSectionTitle: tCareer("resumeSectionTitle"),
    resumeSectionSub: tCareer("resumeSectionSub"),
    fields: {
      headline: tCareer("fields.headline"),
      directionTags: tCareer("fields.directionTags"),
      selfPr: tCareer("fields.selfPr"),
      jobSummary: tCareer("fields.jobSummary"),
      strengths: tCareer("fields.strengths"),
      residenceStatus: tCareer("fields.residenceStatus"),
      residencePeriod: tCareer("fields.residencePeriod"),
      residenceUntil: tCareer("fields.residenceUntil"),
      salaryAnnual: tCareer("fields.salaryAnnual"),
      salaryBonus: tCareer("fields.salaryBonus"),
      salaryMonthly: tCareer("fields.salaryMonthly"),
      salaryOvertime: tCareer("fields.salaryOvertime"),
      salaryHope: tCareer("fields.salaryHope"),
      personalHope: tCareer("fields.personalHope"),
      language: tCareer("fields.language"),
      level: tCareer("fields.level"),
      addLanguage: tCareer("fields.addLanguage"),
    },
  };

  function ymInput(d: Date) {
    return formatYearMonthInputValue(d.getUTCFullYear(), d.getUTCMonth() + 1);
  }

  return (
    <MyCareerCenter
      labels={careerLabels}
      profileForm={{ initial, labels: profileLabels }}
      extras={extras}
      employers={employers.map((e) => ({
        id: e.id,
        companyNameJa: jaOf(e.companyName as LocalizedText),
        title: e.title ?? "",
        startYm: ymInput(e.startYm),
        endYm: e.endYm ? ymInput(e.endYm) : "",
        capitalText: e.capitalText ?? "",
        revenueText: e.revenueText ?? "",
        employeesText: e.employeesText ?? "",
        narrativeJa: jaOf(e.narrative as LocalizedText | null),
      }))}
      projects={projects.map((p) => ({
        id: p.id,
        titleJa: jaOf(p.title as LocalizedText),
        titleUrl: p.titleUrl ?? "",
        startYm: ymInput(p.startYm),
        endYm: p.endYm ? ymInput(p.endYm) : "",
        overviewJa: jaOf(p.overview as LocalizedText | null),
        phasesJa: jaOf(p.phases as LocalizedText | null),
        responsibilitiesJa: jaOf(p.responsibilities as LocalizedText | null),
        resultsJa: jaOf(p.results as LocalizedText | null),
        environment: p.environment ?? "",
        roleText: p.roleText ?? "",
        scaleText: p.scaleText ?? "",
        teamSizeText: p.teamSizeText ?? "",
        status: p.status as "confirmed" | "pending_confirm",
      }))}
      skills={skills.map((s) => ({
        id: s.id,
        category: s.category,
        name: s.name,
        yearsText: s.yearsText,
        description: s.description ?? "",
      }))}
      goals={goals.map((g) => ({
        id: g.id,
        kind: g.kind as "short" | "long",
        contentJa: jaOf(g.content as LocalizedText),
      }))}
      licenses={licenseEntries.map((e) => {
        const ym = formatYearMonthDate(e.acquiredYm);
        return {
          yearMonth: formatYearMonthInputValue(ym.year, ym.month),
          nameJa: localizedJa(e.name as LocalizedText),
        };
      })}
      timeline={timeline}
      exportSnapshot={exportSnapshot}
    />
  );
}
