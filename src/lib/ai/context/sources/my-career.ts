import type { Db } from "@/db";
import { dateToYm, jaLocalized } from "@/lib/ai/context/sensitive";
import type {
  AiContextFragment,
  AiContextSource,
  AiTargetContext,
  ContextSourceLoadArgs,
  ContextSourceSupportArgs,
} from "@/lib/ai/context/types";
import { listCareerEmployers } from "@/lib/data/career-employers";
import { listCareerGoals } from "@/lib/data/career-goals";
import {
  listCareerProjects,
  type CareerProjectRow,
} from "@/lib/data/career-projects";
import { listCareerSkills } from "@/lib/data/career-skills";
import { listEducationEntries } from "@/lib/data/education-entries";
import { listLicenses } from "@/lib/data/licenses";
import { getProfileByUserId, type ProfileRow } from "@/lib/data/profiles";
import { listWorkHistoryEntries } from "@/lib/data/work-history-entries";
import type { LocalizedText } from "@/lib/domain/localized-text";

export const MY_CAREER_SOURCE_ID = "my_career";

function fragment(
  section: string,
  label: string,
  data: unknown,
  notes?: string[],
): AiContextFragment {
  const payload = data ?? null;
  return {
    sourceId: MY_CAREER_SOURCE_ID,
    section,
    label,
    data: payload,
    charCount: JSON.stringify(payload).length,
    notes,
  };
}

function sanitizeProfile(row: ProfileRow) {
  // Explicit whitelist — never spread the raw profile row.
  return {
    fullName: jaLocalized(row.fullName as LocalizedText),
    headline: row.headline ?? null,
    directionTags: row.directionTags ?? [],
    selfPr: jaLocalized(row.selfPr as LocalizedText | null),
    jobSummary: jaLocalized(row.jobSummary as LocalizedText | null),
    strengths: row.strengths ?? [],
    languages: row.languages ?? [],
    nationality: row.nationality ?? null,
    nearestStation: row.nearestStation ?? null,
    personalHope: jaLocalized(row.personalHope as LocalizedText | null),
  };
}

function sanitizeProject(row: CareerProjectRow) {
  return {
    id: row.id,
    title: jaLocalized(row.title as LocalizedText),
    startYm: dateToYm(row.startYm),
    endYm: dateToYm(row.endYm),
    overview: jaLocalized(row.overview as LocalizedText | null),
    phases: jaLocalized(row.phases as LocalizedText | null),
    responsibilities: jaLocalized(
      row.responsibilities as LocalizedText | null,
    ),
    results: jaLocalized(row.results as LocalizedText | null),
    environment: row.environment ?? null,
    roleText: row.roleText ?? null,
    scaleText: row.scaleText ?? null,
    teamSizeText: row.teamSizeText ?? null,
    status: row.status,
  };
}

function isMyCareerTarget(target: AiTargetContext | null): boolean {
  if (!target) return false;
  return (
    target.type === "profile" ||
    target.type === "career_project" ||
    target.type === "education" ||
    target.type === "work_history" ||
    target.type === "license" ||
    target.type === "career_employer"
  );
}

async function loadTargetDetail(
  db: Db,
  userId: string,
  target: AiTargetContext,
): Promise<AiContextFragment | null> {
  switch (target.type) {
    case "profile": {
      const profile = await getProfileByUserId(db, userId);
      if (!profile) {
        return fragment("target", "操作対象: プロフィール", null, [
          "profile_empty",
        ]);
      }
      const safe = sanitizeProfile(profile);
      const section = target.section;
      const data =
        section && section !== "overview"
          ? {
              section,
              value:
                section === "self_pr"
                  ? safe.selfPr
                  : section === "job_summary"
                    ? safe.jobSummary
                    : safe.headline,
              profile: safe,
            }
          : { section: section ?? "overview", profile: safe };
      return fragment("target", "操作対象: プロフィール", data);
    }
    case "career_project": {
      const rows = await listCareerProjects(db, userId);
      const hit = rows.find((r) => r.id === target.id);
      if (!hit) {
        return fragment("target", "操作対象: プロジェクト", null, [
          "target_not_found",
        ]);
      }
      return fragment(
        "target",
        "操作対象: プロジェクト",
        sanitizeProject(hit),
      );
    }
    case "education": {
      const rows = await listEducationEntries(db, userId);
      const hit = rows.find((r) => r.id === target.id);
      if (!hit) {
        return fragment("target", "操作対象: 学歴", null, ["target_not_found"]);
      }
      return fragment("target", "操作対象: 学歴", {
        id: hit.id,
        yearMonth: dateToYm(hit.yearMonth),
        school: jaLocalized(hit.school as LocalizedText),
        eventCode: hit.eventCode,
        note: jaLocalized(hit.note as LocalizedText | null),
      });
    }
    case "work_history": {
      const rows = await listWorkHistoryEntries(db, userId);
      const hit = rows.find((r) => r.id === target.id);
      if (!hit) {
        return fragment("target", "操作対象: 職歴", null, ["target_not_found"]);
      }
      return fragment("target", "操作対象: 職歴", {
        id: hit.id,
        yearMonth: dateToYm(hit.yearMonth),
        company: jaLocalized(hit.company as LocalizedText),
        eventCode: hit.eventCode,
        note: jaLocalized(hit.note as LocalizedText | null),
      });
    }
    case "license": {
      const rows = await listLicenses(db, userId);
      const hit = rows.find((r) => r.id === target.id);
      if (!hit) {
        return fragment("target", "操作対象: 免許・資格", null, [
          "target_not_found",
        ]);
      }
      return fragment("target", "操作対象: 免許・資格", {
        id: hit.id,
        name: jaLocalized(hit.name as LocalizedText),
        acquiredYm: dateToYm(hit.acquiredYm),
      });
    }
    case "career_employer": {
      const rows = await listCareerEmployers(db, userId);
      const hit = rows.find((r) => r.id === target.id);
      if (!hit) {
        return fragment("target", "操作対象: 就業先", null, [
          "target_not_found",
        ]);
      }
      return fragment("target", "操作対象: 就業先", {
        id: hit.id,
        companyName: jaLocalized(hit.companyName as LocalizedText),
        title: hit.title ?? null,
        startYm: dateToYm(hit.startYm),
        endYm: dateToYm(hit.endYm),
        narrative: jaLocalized(hit.narrative as LocalizedText | null),
      });
    }
    default: {
      const _exhaustive: never = target;
      return _exhaustive;
    }
  }
}

export function createMyCareerContextSource(): AiContextSource {
  return {
    id: MY_CAREER_SOURCE_ID,
    supports({ pageContext, targetContext }: ContextSourceSupportArgs) {
      if (isMyCareerTarget(targetContext)) return true;
      if (pageContext?.area === "my_career") return true;
      // No page/target yet (e.g. sidebar open on home): still allow L1 career.
      if (!pageContext && !targetContext) return true;
      return false;
    },
    async load({
      db,
      userId,
      targetContext,
    }: ContextSourceLoadArgs): Promise<AiContextFragment[]> {
      const fragments: AiContextFragment[] = [];

      if (targetContext && isMyCareerTarget(targetContext)) {
        const detail = await loadTargetDetail(db, userId, targetContext);
        if (detail) fragments.push(detail);
      }

      const profile = await getProfileByUserId(db, userId);
      if (profile) {
        fragments.push(
          fragment("profile", "マイキャリア: プロフィール", sanitizeProfile(profile)),
        );
      } else {
        fragments.push(
          fragment("profile", "マイキャリア: プロフィール", null, [
            "profile_empty",
          ]),
        );
      }

      const [education, work, licenses, projects, employers, skills, goals] =
        await Promise.all([
          listEducationEntries(db, userId),
          listWorkHistoryEntries(db, userId),
          listLicenses(db, userId),
          listCareerProjects(db, userId),
          listCareerEmployers(db, userId),
          listCareerSkills(db, userId),
          listCareerGoals(db, userId),
        ]);

      fragments.push(
        fragment(
          "education",
          "マイキャリア: 学歴",
          education.map((e) => ({
            id: e.id,
            yearMonth: dateToYm(e.yearMonth),
            school: jaLocalized(e.school as LocalizedText),
            eventCode: e.eventCode,
            note: jaLocalized(e.note as LocalizedText | null),
          })),
          education.length === 0 ? ["empty"] : undefined,
        ),
        fragment(
          "work_history",
          "マイキャリア: 職歴",
          work.map((e) => ({
            id: e.id,
            yearMonth: dateToYm(e.yearMonth),
            company: jaLocalized(e.company as LocalizedText),
            eventCode: e.eventCode,
            note: jaLocalized(e.note as LocalizedText | null),
          })),
          work.length === 0 ? ["empty"] : undefined,
        ),
        fragment(
          "licenses",
          "マイキャリア: 免許・資格",
          licenses.map((e) => ({
            id: e.id,
            name: jaLocalized(e.name as LocalizedText),
            acquiredYm: dateToYm(e.acquiredYm),
          })),
          licenses.length === 0 ? ["empty"] : undefined,
        ),
        fragment(
          "projects",
          "マイキャリア: プロジェクト",
          projects.map(sanitizeProject),
          projects.length === 0 ? ["empty"] : undefined,
        ),
        fragment(
          "employers",
          "マイキャリア: 就業先",
          employers.map((e) => ({
            id: e.id,
            companyName: jaLocalized(e.companyName as LocalizedText),
            title: e.title ?? null,
            startYm: dateToYm(e.startYm),
            endYm: dateToYm(e.endYm),
            narrative: jaLocalized(e.narrative as LocalizedText | null),
          })),
          employers.length === 0 ? ["empty"] : undefined,
        ),
        fragment(
          "skills",
          "マイキャリア: スキル",
          skills.map((s) => ({
            id: s.id,
            name: s.name,
            category: s.category,
            yearsText: s.yearsText,
            description: s.description ?? null,
          })),
          skills.length === 0 ? ["empty"] : undefined,
        ),
        fragment(
          "goals",
          "マイキャリア: 目標",
          goals.map((g) => ({
            id: g.id,
            kind: g.kind,
            content: jaLocalized(g.content as LocalizedText),
          })),
          goals.length === 0 ? ["empty"] : undefined,
        ),
      );

      return fragments;
    },
  };
}
