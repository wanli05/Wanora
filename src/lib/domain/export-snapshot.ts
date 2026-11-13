import {
  formatExportAsOfJa,
  formatExportAsOfRirekisho,
  jaOf,
  parseLanguages,
  parseStrengths,
  type CareerLanguage,
} from "@/lib/domain/career";
import { fullYearsOld, formatYearMonthJa } from "@/lib/domain/dates";
import type { LocalizedText } from "@/lib/domain/localized-text";
import type {
  EducationEventCode,
  WorkHistoryEventCode,
} from "@/lib/domain/resume-events";

export type ExportProfileSlice = {
  fullName: LocalizedText;
  fullNameKana: string | null;
  birthDate: Date | null;
  gender: LocalizedText | null;
  postalCode: string | null;
  address: LocalizedText | null;
  addressKana: string | null;
  phone: string | null;
  email: string | null;
  selfPr: LocalizedText | null;
  jobSummary: LocalizedText | null;
  strengths: unknown;
  languages: unknown;
  residenceStatus: string | null;
  residencePeriod: string | null;
  residenceUntil: Date | null;
  salaryAnnualMan: number | null;
  salaryBonusMan: number | null;
  salaryMonthlyMan: number | null;
  salaryOvertimeMan: number | null;
  salaryHope: string | null;
  personalHope: LocalizedText | null;
};

export type ExportEducationRow = {
  yearMonth: Date;
  school: LocalizedText;
  eventCode: EducationEventCode;
};

export type ExportWorkRow = {
  yearMonth: Date;
  company: LocalizedText;
  eventCode: WorkHistoryEventCode;
};

export type ExportLicenseRow = {
  acquiredYm: Date;
  name: LocalizedText;
};

export type ExportEmployerRow = {
  companyName: LocalizedText;
  title: string | null;
  startYm: Date;
  endYm: Date | null;
  capitalText: string | null;
  revenueText: string | null;
  employeesText: string | null;
  narrative: LocalizedText | null;
};

export type ExportProjectRow = {
  title: LocalizedText;
  titleUrl: string | null;
  startYm: Date;
  endYm: Date | null;
  overview: LocalizedText | null;
  phases: LocalizedText | null;
  responsibilities: LocalizedText | null;
  results: LocalizedText | null;
  environment: string | null;
  roleText: string | null;
  scaleText: string | null;
  teamSizeText: string | null;
  status: string;
};

export type ExportSkillRow = {
  category: string;
  name: string;
  yearsText: string;
  description: string | null;
};

export type ExportSnapshot = {
  asOfRirekisho: string;
  asOfShokumu: string;
  fullName: string;
  fullNameKana: string;
  birthLine: string;
  gender: string;
  addressKana: string;
  address: string;
  postalCode: string;
  phone: string;
  email: string;
  educationLines: { year: string; month: string; text: string }[];
  workLines: { year: string; month: string; text: string }[];
  licenseLines: { year: string; month: string; text: string }[];
  residenceLines: string[];
  salaryLines: string[];
  languages: CareerLanguage[];
  personalHope: string;
  jobCareerLine: string;
  jobSummary: string;
  strengths: string[];
  employers: {
    header: string;
    meta: string;
  }[];
  projects: {
    period: string;
    title: string;
    titleUrl: string | null;
    overview: string;
    phases: string;
    responsibilities: string;
    results: string;
    environment: string;
    roleScale: string;
  }[];
  skillRows: ExportSkillRow[];
  selfPr: string;
  selfStudyLinks: { label: string; url: string }[];
};

const EDUCATION_EVENT_JA: Record<EducationEventCode, string> = {
  enrolled: "入学",
  graduated: "卒業",
  withdrawn: "中途退学",
  completed: "修了",
};

const WORK_EVENT_JA: Record<WorkHistoryEventCode, string> = {
  joined: "入社",
  left: "退社",
  transferred: "異動",
};

function ymParts(d: Date): { year: string; month: string; y: number; m: number } {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return { year: String(y), month: String(m), y, m };
}

function formatYm(d: Date): string {
  const { y, m } = ymParts(d);
  return formatYearMonthJa(y, m);
}

function formatPeriod(start: Date, end: Date | null): string {
  const startLabel = formatYm(start);
  if (!end) return `${startLabel}\n～\n現在`;
  return `${startLabel}\n～\n${formatYm(end)}`;
}

function moneyLine(
  annual: number | null,
  bonus: number | null,
  monthly: number | null,
  overtime: number | null,
  hope: string | null,
): string[] {
  const lines: string[] = [];
  if (annual != null) {
    const bonusPart =
      bonus != null ? `　（うち賞与　${bonus}　万円）` : "";
    lines.push(`年収　${annual}　万円${bonusPart}`);
  }
  if (monthly != null) {
    const ot =
      overtime != null
        ? `　（うち時間外　${overtime}万円　うち諸手当　　万円）`
        : "";
    lines.push(`月収　${monthly}　万円${ot}`);
  }
  if (hope) {
    lines.push(`希望年収　${hope}`);
  }
  return lines;
}

/**
 * Prefer Work History (career_employers) for 履歴書 職歴 lines.
 * Fall back to legacy work_history_entries when no employers exist.
 */
export function resolveExportWorkHistory(
  employers: ExportEmployerRow[],
  legacy: ExportWorkRow[],
): ExportWorkRow[] {
  if (employers.length === 0) return legacy;
  const sorted = [...employers].sort(
    (a, b) => a.startYm.getTime() - b.startYm.getTime(),
  );
  const rows: ExportWorkRow[] = [];
  for (const e of sorted) {
    const companyJa = jaOf(e.companyName);
    const title = e.title?.trim() ?? "";
    const joinedLabel = title ? `${companyJa}　${title}` : companyJa;
    rows.push({
      yearMonth: e.startYm,
      company: { ja: joinedLabel },
      eventCode: "joined",
    });
    if (e.endYm) {
      rows.push({
        yearMonth: e.endYm,
        company: e.companyName,
        eventCode: "left",
      });
    }
  }
  return rows;
}

export function buildExportSnapshot(input: {
  profile: ExportProfileSlice;
  education: ExportEducationRow[];
  workHistory: ExportWorkRow[];
  licenses: ExportLicenseRow[];
  employers: ExportEmployerRow[];
  projects: ExportProjectRow[];
  skills: ExportSkillRow[];
  now?: Date;
}): ExportSnapshot {
  const now = input.now ?? new Date();
  const p = input.profile;
  const age = p.birthDate ? fullYearsOld(p.birthDate) : null;
  const birthLine =
    p.birthDate != null
      ? `${p.birthDate.getUTCFullYear()}年　${p.birthDate.getUTCMonth() + 1}月　${p.birthDate.getUTCDate()}日生${
          age != null ? `（満　${age}　歳）` : ""
        }`
      : "";

  const educationLines = input.education.map((row) => {
    const { year, month } = ymParts(row.yearMonth);
    return {
      year,
      month,
      text: `${jaOf(row.school)}　${EDUCATION_EVENT_JA[row.eventCode]}`,
    };
  });

  const resolvedWork = resolveExportWorkHistory(
    input.employers,
    input.workHistory,
  );
  const workLines = resolvedWork.map((row) => {
    const { year, month } = ymParts(row.yearMonth);
    return {
      year,
      month,
      text: `${jaOf(row.company)}　${WORK_EVENT_JA[row.eventCode]}`,
    };
  });

  const licenseLines = input.licenses.map((row) => {
    const { year, month } = ymParts(row.acquiredYm);
    return {
      year,
      month,
      text: jaOf(row.name),
    };
  });

  const residenceLines: string[] = [];
  if (p.residenceStatus) {
    residenceLines.push(`・在留資格：${p.residenceStatus}`);
  }
  if (p.residencePeriod || p.residenceUntil) {
    const until = p.residenceUntil
      ? `${p.residenceUntil.getUTCFullYear()}年${String(p.residenceUntil.getUTCMonth() + 1).padStart(2, "0")}月${String(p.residenceUntil.getUTCDate()).padStart(2, "0")}日`
      : "";
    const period = p.residencePeriod ?? "";
    residenceLines.push(
      `・在留期間：${period}${until ? `（${until}）` : ""}`,
    );
  }

  const confirmedProjects = input.projects.filter(
    (x) => x.status === "confirmed",
  );
  const selfStudyLinks = confirmedProjects
    .filter((x) => x.titleUrl)
    .map((x) => ({
      label: jaOf(x.title) || x.titleUrl!,
      url: x.titleUrl!,
    }));

  const firstEmployer = input.employers[0];
  const firstJoined = resolvedWork.find((w) => w.eventCode === "joined");
  const jobCareerLine = firstEmployer
    ? `${formatYm(firstEmployer.startYm)}　${jaOf(firstEmployer.companyName)}　入社\n現在に至る`
    : firstJoined
      ? `${formatYm(firstJoined.yearMonth)}　${jaOf(firstJoined.company)}　入社\n現在に至る`
      : "";

  return {
    asOfRirekisho: formatExportAsOfRirekisho(now),
    asOfShokumu: formatExportAsOfJa(now),
    fullName: jaOf(p.fullName),
    fullNameKana: p.fullNameKana?.trim() ?? "",
    birthLine,
    gender: jaOf(p.gender),
    addressKana: p.addressKana?.trim() ?? "",
    address: [p.postalCode ? `〒${p.postalCode}` : "", jaOf(p.address)]
      .filter(Boolean)
      .join("\n"),
    postalCode: p.postalCode?.trim() ?? "",
    phone: p.phone?.trim() ?? "",
    email: p.email?.trim() ?? "",
    educationLines,
    workLines,
    licenseLines,
    residenceLines,
    salaryLines: moneyLine(
      p.salaryAnnualMan,
      p.salaryBonusMan,
      p.salaryMonthlyMan,
      p.salaryOvertimeMan,
      p.salaryHope,
    ),
    languages: parseLanguages(p.languages),
    personalHope: jaOf(p.personalHope) || "貴社規定に従います。",
    jobCareerLine,
    jobSummary: jaOf(p.jobSummary),
    strengths: parseStrengths(p.strengths),
    employers: input.employers.map((e) => {
      const end = e.endYm ? formatYm(e.endYm) : "現在";
      const metaParts = [
        e.capitalText ? `資本金：${e.capitalText}` : null,
        e.revenueText ? `売上高：${e.revenueText}` : null,
        e.employeesText ? `従業員数：${e.employeesText}` : null,
      ].filter(Boolean);
      return {
        header: `${jaOf(e.companyName)}　〔在籍期間：${formatYm(e.startYm)}～${end}〕`,
        meta: metaParts.join("、"),
      };
    }),
    projects: confirmedProjects.map((proj) => ({
      period: formatPeriod(proj.startYm, proj.endYm),
      title: jaOf(proj.title),
      titleUrl: proj.titleUrl,
      overview: jaOf(proj.overview),
      phases: jaOf(proj.phases),
      responsibilities: jaOf(proj.responsibilities),
      results: jaOf(proj.results),
      environment: proj.environment?.trim() ?? "",
      roleScale: [
        proj.roleText ? `【役割】\n${proj.roleText}` : "",
        proj.scaleText ? `【規模】\n${proj.scaleText}` : "",
        proj.teamSizeText ? `チーム規模：\n${proj.teamSizeText}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    })),
    skillRows: input.skills,
    selfPr: jaOf(p.selfPr),
    selfStudyLinks,
  };
}
