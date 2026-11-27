"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type MutableRefObject,
} from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AiModuleRefineButton,
  AiRefineButton,
} from "@/components/ai-sidebar/ai-refine-button";
import { useAiAssistOptional } from "@/components/ai-sidebar/ai-assist-context";
import {
  canApplyToProfileDraft,
  canApplyToRecordDraft,
} from "@/components/ai-sidebar/assist-apply-guard";
import { rebindAssistConversation } from "@/components/ai-sidebar/ai-api";
import {
  PROFILE_MODULE_FIELD_IDS,
  PROJECT_MODULE_FIELD_IDS,
  serializeModuleDrafts,
} from "@/components/ai-sidebar/refine-prompts";
import { useLiveRef } from "@/components/ai-sidebar/use-live-ref";
import {
  assistSlotKeyForCareerEmployer,
  assistSlotKeyForCareerEmployerDraft,
  assistSlotKeyForCareerProject,
  assistSlotKeyForCareerProjectDraft,
  assistSlotKeyForProfile,
  assistSlotKeyForProfileModule,
} from "@/lib/ai/conversation/assist-slot";
import {
  ProfilePageForm,
  type ProfilePageFormLabels,
  type ProfilePageInitial,
} from "@/components/profile-page-form";
import { ExportSheets } from "@/components/my-career/export-sheets";
import {
  confirmPendingProjectAction,
  deleteCareerEmployerAction,
  deleteCareerGoalAction,
  deleteCareerProjectAction,
  deleteCareerSkillAction,
  saveCareerEmployerAction,
  saveCareerGoalAction,
  saveCareerProfileExtrasAction,
  saveCareerProjectAction,
  saveCareerSkillAction,
  type CareerSaveState,
} from "@/lib/career-actions";
import {
  deleteLicenseAction,
  saveLicenseAction,
} from "@/lib/profile-actions";
import {
  isJapaneseNationality,
  jaOf,
  type CareerLanguage,
  type CareerTimelineItem,
} from "@/lib/domain/career";
import { planSkillTableRows } from "@/lib/domain/career-skills-table";
import { groupCareerTimelineByAt } from "@/lib/domain/career-timeline";
import type { ExportSnapshot } from "@/lib/domain/export-snapshot";
import { formatYearMonthInputValue } from "@/lib/domain/dates";
import type { LocalizedText } from "@/lib/domain/localized-text";

export type CareerLicenseDto = {
  id: string;
  yearMonth: string;
  nameJa: string;
};

export type MyCareerModule =
  | "profile"
  | "work"
  | "projects"
  | "skills"
  | "goals"
  | "timeline"
  | "export";

export type MyCareerLabels = {
  modules: Record<MyCareerModule, string>;
  save: string;
  add: string;
  remove: string;
  edit: string;
  cancel: string;
  saved: string;
  errors: Record<NonNullable<CareerSaveState["error"]>, string>;
  workSub: string;
  projectsSub: string;
  projectsPendingHint: string;
  confirmDraft: string;
  skillsSub: string;
  skillsLicensesSub: string;
  skillsLicensesEmpty: string;
  goalsSub: string;
  goalShort: string;
  goalLong: string;
  timelineSub: string;
  exportSub: string;
  exportRireki: string;
  exportShokumu: string;
  exportDocx: string;
  exportPdf: string;
  exportPrint: string;
  exportRetry: string;
  exportPreviewLoading: string;
  exportPreviewFailed: string;
  exportDownloading: string;
  exportFailed: string;
  residence: string;
  salary: string;
  languages: string;
  titleUrl: string;
  pendingBadge: string;
  snapshotTitle: string;
  snapProjects: string;
  snapSkills: string;
  snapHope: string;
  recentTitle: string;
  recentSub: string;
  resumeSectionTitle: string;
  resumeSectionSub: string;
  nationalityBlock: string;
  japaneseLocksHint: string;
  fields: {
    headline: string;
    headlinePlaceholder: string;
    directionTags: string;
    directionTagsPlaceholder: string;
    selfPr: string;
    jobSummary: string;
    strengths: string;
    nationality: string;
    residenceStatus: string;
    residenceUntil: string;
    salaryAnnual: string;
    salaryMonthly: string;
    salaryHope: string;
    personalHope: string;
    language: string;
    level: string;
    addLanguage: string;
  };
};

export type CareerEmployerDto = {
  id: string;
  companyNameJa: string;
  title: string;
  startYm: string;
  endYm: string;
  capitalText: string;
  revenueText: string;
  employeesText: string;
  narrativeJa: string;
};

export type CareerProjectDto = {
  id: string;
  titleJa: string;
  titleUrl: string;
  startYm: string;
  endYm: string;
  overviewJa: string;
  phasesJa: string;
  responsibilitiesJa: string;
  resultsJa: string;
  environment: string;
  roleText: string;
  scaleText: string;
  teamSizeText: string;
  status: "confirmed" | "pending_confirm";
};

export type CareerSkillDto = {
  id: string;
  category: string;
  name: string;
  yearsText: string;
  description: string;
};

export type CareerGoalDto = {
  id: string;
  kind: "short" | "long";
  contentJa: string;
};

export type CareerExtrasInitial = {
  headline: string;
  directionTags: string;
  selfPrJa: string;
  jobSummaryJa: string;
  strengthsText: string;
  languages: CareerLanguage[];
  nationality: string;
  residenceStatus: string;
  residenceUntil: string;
  salaryAnnualMan: string;
  salaryMonthlyMan: string;
  salaryHope: string;
  personalHopeJa: string;
};

type Props = {
  labels: MyCareerLabels;
  profileForm: {
    initial: ProfilePageInitial;
    labels: ProfilePageFormLabels;
  };
  extras: CareerExtrasInitial;
  employers: CareerEmployerDto[];
  projects: CareerProjectDto[];
  skills: CareerSkillDto[];
  goals: CareerGoalDto[];
  licenses: CareerLicenseDto[];
  timeline: CareerTimelineItem[];
  exportSnapshot: ExportSnapshot;
};

const MODULES: MyCareerModule[] = [
  "profile",
  "work",
  "projects",
  "skills",
  "goals",
  "timeline",
  "export",
];

export function MyCareerCenter(props: Props) {
  const [module, setModule] = useState<MyCareerModule>("profile");
  const [exportDoc, setExportDoc] = useState<"rirekisho" | "shokumu">(
    "rirekisho",
  );
  const assist = useAiAssistOptional();
  const tAi = useTranslations("AiSidebar");

  useEffect(() => {
    return () => {
      assist?.invalidateAssistApply();
    };
    // Intentionally only on unmount — drop form write-back when leaving My Page.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount cleanup
  }, []);

  return (
    <div className="mc-shell">
      {assist?.bridgeError === "ai_unavailable" ? (
        <p className="mc-banner" data-testid="ai-bridge-unavailable" role="alert">
          {tAi("aiUnavailableShort")}
          <button
            type="button"
            className="mc-btn mc-btn-ghost"
            onClick={() => assist.clearBridgeError()}
          >
            {props.labels.cancel}
          </button>
        </p>
      ) : null}
      <div className="mc-layout">
        <nav
          className="mc-tabs mc-no-print"
          data-testid="mc-module-tabs"
        >
          <div className="mc-tabs-scroll">
            {MODULES.map((id) => (
              <button
                key={id}
                type="button"
                className="mc-tab"
                aria-current={module === id ? "page" : undefined}
                data-active={module === id ? "true" : "false"}
                onClick={() => {
                  if (id !== module) {
                    assist?.invalidateAssistApply();
                  }
                  setModule(id);
                }}
              >
                {props.labels.modules[id]}
              </button>
            ))}
          </div>
        </nav>
        <div className="mc-main">
          {module === "profile" ? (
            <ProfileModule {...props} />
          ) : null}
          {module === "work" ? (
            <WorkModule
              labels={props.labels}
              employers={props.employers}
            />
          ) : null}
          {module === "projects" ? (
            <ProjectsModule labels={props.labels} projects={props.projects} />
          ) : null}
          {module === "skills" ? (
            <SkillsModule
              labels={props.labels}
              skills={props.skills}
              licenses={props.licenses}
            />
          ) : null}
          {module === "goals" ? (
            <GoalsModule labels={props.labels} goals={props.goals} />
          ) : null}
          {module === "timeline" ? (
            <TimelineModule
              labels={props.labels}
              timeline={props.timeline}
              onJump={setModule}
            />
          ) : null}
          {module === "export" ? (
            <ExportModule
              labels={props.labels}
              snapshot={props.exportSnapshot}
              photoUrl={
                props.exportSnapshot.hasPhoto ? "/api/profile/photo" : null
              }
              doc={exportDoc}
              setDoc={setExportDoc}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Feedback({
  state,
  labels,
}: {
  state: CareerSaveState;
  labels: MyCareerLabels;
}) {
  if (state.ok) return <p className="text-sm text-teal-800">{labels.saved}</p>;
  if (state.error)
    return <p className="text-sm text-red-700">{labels.errors[state.error]}</p>;
  return null;
}

function dash(value: string | null | undefined): string {
  const v = value?.trim();
  return v ? v : "—";
}

function ProfileModule({
  labels,
  profileForm,
  extras,
  projects,
  skills,
  timeline,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(
    saveCareerProfileExtrasAction,
    {},
  );
  const wasPending = useRef(false);
  const [langs, setLangs] = useState(extras.languages);
  const [nationality, setNationality] = useState(extras.nationality);
  const [selfPrJa, setSelfPrJa] = useState(extras.selfPrJa);
  const [jobSummaryJa, setJobSummaryJa] = useState(extras.jobSummaryJa);
  const [strengthsJa, setStrengthsJa] = useState(extras.strengthsText);
  const [draftDirtyHint, setDraftDirtyHint] = useState<string | null>(null);
  const tAi = useTranslations("AiSidebar");
  const assist = useAiAssistOptional();
  const mountedRef = useRef(true);
  const editingRef = useLiveRef(editing);
  const selfPrJaRef = useLiveRef(selfPrJa);
  const jobSummaryJaRef = useLiveRef(jobSummaryJa);
  const strengthsJaRef = useLiveRef(strengthsJa);
  const japanese = isJapaneseNationality(nationality);
  const recentGroups = useMemo(
    () => groupCareerTimelineByAt(timeline).slice(0, 4),
    [timeline],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      assist?.invalidateAssistApply();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount cleanup
  }, []);

  useEffect(() => {
    if (wasPending.current && !pending && state.ok) {
      assist?.invalidateAssistApply();
      setEditing(false);
      setDraftDirtyHint(null);
      router.refresh();
    }
    wasPending.current = pending;
  }, [pending, state.ok, router, assist]);

  // Legacy + module slot binders for history write-back while profile editor is open.
  useEffect(() => {
    if (!assist || !editing) return;
    const profileGuard = () =>
      canApplyToProfileDraft({
        mounted: mountedRef.current,
        editorOpen: editingRef.current,
      });
    const getDrafts = () => ({
      self_pr: selfPrJaRef.current,
      job_summary: jobSummaryJaRef.current,
      strengths: strengthsJaRef.current,
    });
    const applyFields = (fields: Readonly<Record<string, string>>) => {
      if (!profileGuard()) return false;
      if (fields.self_pr !== undefined) setSelfPrJa(fields.self_pr);
      if (fields.job_summary !== undefined) setJobSummaryJa(fields.job_summary);
      if (fields.strengths !== undefined) setStrengthsJa(fields.strengths);
      setDraftDirtyHint(tAi("applyDraftOnly"));
      return true;
    };
    const unbindModule = assist.registerLegacySlotBinder(
      assistSlotKeyForProfileModule(),
      () => ({
        target: { type: "profile", section: "module" },
        draftText: "",
        feature: "profile_module_refine",
        fieldKey: "profile_module",
        draftSnapshot: serializeModuleDrafts(
          PROFILE_MODULE_FIELD_IDS,
          getDrafts(),
        ),
        applyMode: "multi",
        allowedFieldIds: PROFILE_MODULE_FIELD_IDS,
        getCurrentDraft: () =>
          serializeModuleDrafts(PROFILE_MODULE_FIELD_IDS, getDrafts()),
        getCurrentDrafts: getDrafts,
        onApplyFields: applyFields,
        onApplyToDraft: () => false,
      }),
    );
    const unbindSelfPr = assist.registerLegacySlotBinder(
      assistSlotKeyForProfile("self_pr"),
      () => ({
        target: { type: "profile", section: "self_pr" },
        draftText: selfPrJaRef.current,
        feature: "self_pr_refine",
        fieldKey: "selfPr_ja",
        draftSnapshot: selfPrJaRef.current,
        applyMode: "single",
        getCurrentDraft: () => selfPrJaRef.current,
        onApplyToDraft: (text) => {
          if (!profileGuard()) return false;
          setSelfPrJa(text);
          setDraftDirtyHint(tAi("applyDraftOnly"));
          return true;
        },
      }),
    );
    const unbindJob = assist.registerLegacySlotBinder(
      assistSlotKeyForProfile("job_summary"),
      () => ({
        target: { type: "profile", section: "job_summary" },
        draftText: jobSummaryJaRef.current,
        feature: "job_summary_refine",
        fieldKey: "jobSummary_ja",
        draftSnapshot: jobSummaryJaRef.current,
        applyMode: "single",
        getCurrentDraft: () => jobSummaryJaRef.current,
        onApplyToDraft: (text) => {
          if (!profileGuard()) return false;
          setJobSummaryJa(text);
          setDraftDirtyHint(tAi("applyDraftOnly"));
          return true;
        },
      }),
    );
    return () => {
      unbindModule();
      unbindSelfPr();
      unbindJob();
    };
  }, [assist, editing, editingRef, selfPrJaRef, jobSummaryJaRef, strengthsJaRef, tAi]);

  const name = jaOf(profileForm.initial.fullName as LocalizedText);
  const tags = extras.directionTags
    .split(/[,、]/)
    .map((t) => t.trim())
    .filter(Boolean);
  const confirmedProjects = projects.filter((p) => p.status === "confirmed");
  const salaryNow =
    extras.salaryAnnualMan.trim() !== ""
      ? `${extras.salaryAnnualMan}万円`
      : "—";
  const salaryMonth =
    extras.salaryMonthlyMan.trim() !== ""
      ? `${extras.salaryMonthlyMan}万円`
      : "—";

  return (
    <div className="mc-stack">
      <div className="mc-panel-actions mc-no-print">
        {editing ? (
          <button
            type="button"
            className="mc-btn mc-btn-ghost"
            onClick={() => {
              assist?.invalidateAssistApply();
              setLangs(extras.languages);
              setNationality(extras.nationality);
              setSelfPrJa(extras.selfPrJa);
              setJobSummaryJa(extras.jobSummaryJa);
              setStrengthsJa(extras.strengthsText);
              setDraftDirtyHint(null);
              setEditing(false);
            }}
          >
            {labels.cancel}
          </button>
        ) : (
          <button
            type="button"
            className="mc-btn"
            onClick={() => {
              assist?.invalidateAssistApply();
              setLangs(extras.languages);
              setNationality(extras.nationality);
              setSelfPrJa(extras.selfPrJa);
              setJobSummaryJa(extras.jobSummaryJa);
              setStrengthsJa(extras.strengthsText);
              setDraftDirtyHint(null);
              setEditing(true);
            }}
          >
            {labels.edit}
          </button>
        )}
      </div>

      {!editing ? (
        <>
          <div className="mc-hero">
            <div className="mc-identity">
              <p className="mc-identity-name">{dash(name)}</p>
              <p className="mc-identity-meta">{dash(extras.headline)}</p>
              {tags.length > 0 ? (
                <div className="mc-chips">
                  {tags.map((tag) => (
                    <span key={tag} className="mc-chip">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              {extras.selfPrJa.trim() ? (
                <p className="mc-identity-pr">{extras.selfPrJa}</p>
              ) : (
                <p className="mc-empty">{labels.fields.selfPr}</p>
              )}
            </div>
            <div className="mc-snapshot">
              <h3>{labels.snapshotTitle}</h3>
              <dl>
                <div>
                  <dt>{labels.snapProjects}</dt>
                  <dd>{confirmedProjects.length}</dd>
                </div>
                <div>
                  <dt>{labels.snapSkills}</dt>
                  <dd>{skills.length}</dd>
                </div>
                <div>
                  <dt>{labels.snapHope}</dt>
                  <dd>{dash(extras.salaryHope)}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="mc-meta-grid">
            <div className="mc-card">
              <h3>{labels.nationalityBlock}</h3>
              <dl className="mc-dl">
                <dt>{labels.fields.nationality}</dt>
                <dd>{dash(extras.nationality)}</dd>
                <dt>{labels.fields.residenceStatus}</dt>
                <dd>
                  {isJapaneseNationality(extras.nationality)
                    ? "—"
                    : dash(extras.residenceStatus)}
                </dd>
                <dt>{labels.fields.residenceUntil}</dt>
                <dd>
                  {isJapaneseNationality(extras.nationality)
                    ? "—"
                    : dash(extras.residenceUntil)}
                </dd>
              </dl>
            </div>
            <div className="mc-card">
              <h3>{labels.salary}</h3>
              <dl className="mc-dl">
                <dt>{labels.fields.salaryAnnual}</dt>
                <dd>{salaryNow}</dd>
                <dt>{labels.fields.salaryMonthly}</dt>
                <dd>{salaryMonth}</dd>
                <dt>{labels.fields.salaryHope}</dt>
                <dd>{dash(extras.salaryHope)}</dd>
              </dl>
            </div>
          </div>

          <div className="mc-card">
            <h3
              style={{
                margin: "0 0 8px",
                fontSize: 14,
                color: "var(--mc-teal-deep)",
              }}
            >
              {labels.languages}
            </h3>
            {langs.length > 0 ? (
              <ul className="mc-lang-list">
                {langs.map((lang, i) => (
                  <li key={`${lang.language}-${i}`}>
                    {lang.language} — {lang.level}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mc-empty">—</p>
            )}
          </div>
        </>
      ) : (
        <form action={action} className="mc-edit-panel">
          <input
            type="hidden"
            name="languagesJson"
            value={JSON.stringify(langs)}
          />
          <div className="mc-card">
            <div className="mc-module-title-row">
              <h3>{labels.modules.profile}</h3>
              <AiModuleRefineButton
                kind="profile"
                drafts={{
                  self_pr: selfPrJa,
                  job_summary: jobSummaryJa,
                  strengths: strengthsJa,
                }}
                getCurrentDrafts={() => ({
                  self_pr: selfPrJaRef.current,
                  job_summary: jobSummaryJaRef.current,
                  strengths: strengthsJaRef.current,
                })}
                onApplyFields={(fields) => {
                  if (
                    !canApplyToProfileDraft({
                      mounted: mountedRef.current,
                      editorOpen: editingRef.current,
                    })
                  ) {
                    return false;
                  }
                  if (fields.self_pr !== undefined) setSelfPrJa(fields.self_pr);
                  if (fields.job_summary !== undefined) {
                    setJobSummaryJa(fields.job_summary);
                  }
                  if (fields.strengths !== undefined) {
                    setStrengthsJa(fields.strengths);
                  }
                  setDraftDirtyHint(tAi("applyDraftOnly"));
                  return true;
                }}
              />
            </div>
            <label className="mc-field">
              {labels.fields.headline}
              <input
                name="headline"
                defaultValue={extras.headline}
                placeholder={labels.fields.headlinePlaceholder}
              />
            </label>
            <label className="mc-field">
              {labels.fields.directionTags}
              <input
                name="directionTags"
                defaultValue={extras.directionTags}
                placeholder={labels.fields.directionTagsPlaceholder}
              />
            </label>
            <label className="mc-field">
              {labels.fields.selfPr}
              <textarea
                name="selfPr_ja"
                rows={4}
                value={selfPrJa}
                data-testid="mc-self-pr-input"
                onChange={(e) => {
                  setSelfPrJa(e.target.value);
                  setDraftDirtyHint(null);
                }}
              />
            </label>
            <label className="mc-field">
              {labels.fields.jobSummary}
              <textarea
                name="jobSummary_ja"
                rows={4}
                value={jobSummaryJa}
                data-testid="mc-job-summary-input"
                onChange={(e) => {
                  setJobSummaryJa(e.target.value);
                  setDraftDirtyHint(null);
                }}
              />
            </label>
            {draftDirtyHint ? (
              <p className="text-sm text-amber-800" data-testid="mc-ai-draft-hint">
                {draftDirtyHint}
              </p>
            ) : null}
            <label className="mc-field">
              {labels.fields.strengths}
              <textarea
                name="strengths"
                rows={4}
                value={strengthsJa}
                data-testid="mc-strengths-input"
                onChange={(e) => {
                  setStrengthsJa(e.target.value);
                  setDraftDirtyHint(null);
                }}
              />
            </label>
            <label className="mc-field">
              {labels.fields.personalHope}
              <textarea
                name="personalHope_ja"
                rows={2}
                defaultValue={extras.personalHopeJa}
              />
            </label>
          </div>

          <div className="mc-meta-grid">
            <div className="mc-card">
              <h3>{labels.nationalityBlock}</h3>
              <label className="mc-field">
                {labels.fields.nationality}
                <input
                  name="nationality"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                />
              </label>
              {japanese ? (
                <p className="mc-empty" style={{ marginBottom: 10 }}>
                  {labels.japaneseLocksHint}
                </p>
              ) : null}
              <label className="mc-field">
                {labels.fields.residenceStatus}
                <input
                  key={japanese ? "status-jp" : "status-other"}
                  name="residenceStatus"
                  defaultValue={japanese ? "" : extras.residenceStatus}
                  disabled={japanese}
                />
              </label>
              <label className="mc-field">
                {labels.fields.residenceUntil}
                <input
                  key={japanese ? "until-jp" : "until-other"}
                  type="date"
                  name="residenceUntil"
                  defaultValue={japanese ? "" : extras.residenceUntil}
                  disabled={japanese}
                />
              </label>
            </div>
            <div className="mc-card">
              <h3>{labels.salary}</h3>
              <label className="mc-field">
                {labels.fields.salaryAnnual}
                <input
                  name="salaryAnnualMan"
                  defaultValue={extras.salaryAnnualMan}
                />
              </label>
              <label className="mc-field">
                {labels.fields.salaryMonthly}
                <input
                  name="salaryMonthlyMan"
                  defaultValue={extras.salaryMonthlyMan}
                />
              </label>
              <label className="mc-field">
                {labels.fields.salaryHope}
                <input name="salaryHope" defaultValue={extras.salaryHope} />
              </label>
            </div>
          </div>

          <div className="mc-card">
            <h3>{labels.languages}</h3>
            <LanguageEditor
              labels={labels}
              languages={langs}
              onChange={setLangs}
            />
          </div>

          <div className="mc-panel-actions">
            <button className="mc-btn" type="submit" disabled={pending}>
              {labels.save}
            </button>
          </div>
          <Feedback state={state} labels={labels} />
        </form>
      )}

      <div className="mc-sec-head">
        <div>
          <h2>{labels.resumeSectionTitle}</h2>
          <p>{labels.resumeSectionSub}</p>
        </div>
      </div>
      <div className="mc-resume-wrap">
        <ProfilePageForm
          initial={profileForm.initial}
          labels={profileForm.labels}
          includeLicenses={false}
        />
      </div>

      <div className="mc-sec-head">
        <div>
          <h2>{labels.recentTitle}</h2>
          <p>{labels.recentSub}</p>
        </div>
      </div>
      <div className="mc-timeline">
        {recentGroups.map((group) => (
          <div key={group.at} className="mc-tl-row">
            <p className="mc-tl-at">{group.at}</p>
            <div className="mc-tl-rail" aria-hidden />
            <div className="mc-tl-cluster">
              {group.items.map((item) => (
                <div key={item.id} className="mc-tl-item">
                  <h3 className="text-sm font-semibold text-[var(--mc-teal-deep)]">
                    {item.title}
                  </h3>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LanguageEditor({
  labels,
  languages,
  onChange,
}: {
  labels: MyCareerLabels;
  languages: CareerLanguage[];
  onChange: (next: CareerLanguage[]) => void;
}) {
  return (
    <div className="mc-stack">
      {languages.map((lang, index) => (
        <div key={index} className="mc-grid-2">
          <label className="mc-field">
            {labels.fields.language}
            <input
              value={lang.language}
              onChange={(e) => {
                const next = [...languages];
                next[index] = { ...lang, language: e.target.value };
                onChange(next);
              }}
            />
          </label>
          <label className="mc-field">
            {labels.fields.level}
            <input
              value={lang.level}
              onChange={(e) => {
                const next = [...languages];
                next[index] = { ...lang, level: e.target.value };
                onChange(next);
              }}
            />
          </label>
        </div>
      ))}
      <button
        type="button"
        className="mc-btn mc-btn-ghost"
        onClick={() =>
          onChange([...languages, { language: "", level: "ビジネス" }])
        }
      >
        {labels.fields.addLanguage}
      </button>
    </div>
  );
}

function WorkModule({
  labels,
  employers,
}: {
  labels: MyCareerLabels;
  employers: CareerEmployerDto[];
}) {
  const [state, action, pending] = useActionState(saveCareerEmployerAction, {});
  const [editing, setEditing] = useState<CareerEmployerDto | null>(null);
  const [draftDirtyHint, setDraftDirtyHint] = useState<string | null>(null);
  /** Per unsaved-editor instance; used for AI assist slot isolation. */
  const [clientDraftKey, setClientDraftKey] = useState<string | null>(null);
  const clientDraftKeyRef = useLiveRef(clientDraftKey);
  const tAi = useTranslations("AiSidebar");
  const assist = useAiAssistOptional();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const mountedRef = useRef(true);
  const editingRef = useLiveRef(editing);
  const lastRebindTokenRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      assist?.invalidateAssistApply();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount cleanup
  }, []);

  useEffect(() => {
    if (!state.ok || !state.id) return;
    const draftKey = clientDraftKeyRef.current;
    if (!draftKey) {
      // Already a saved row — keep editing id in sync after update.
      setEditing((prev) => (prev ? { ...prev, id: state.id! } : prev));
      return;
    }
    const token = `${draftKey}->${state.id}`;
    if (lastRebindTokenRef.current === token) return;
    lastRebindTokenRef.current = token;
    const recordId = state.id;
    void (async () => {
      const res = await rebindAssistConversation({
        fromAssistSlotKey: assistSlotKeyForCareerEmployerDraft(draftKey),
        toAssistSlotKey: assistSlotKeyForCareerEmployer(recordId),
        pinnedTarget: { type: "career_employer", id: recordId },
      });
      if (!mountedRef.current) return;
      if ("error" in res) {
        // Do not fake success; career Save already committed.
        setDraftDirtyHint(tAi("errSend"));
        return;
      }
      setClientDraftKey(null);
      setEditing((prev) => (prev ? { ...prev, id: recordId } : prev));
      router.refresh();
    })();
  }, [state, clientDraftKeyRef, router, tAi]);

  function openEmployerEditor(row: CareerEmployerDto) {
    if (editingRef.current?.id !== row.id) {
      assist?.invalidateAssistApply();
    }
    setClientDraftKey(null);
    setEditing(row);
    setDraftDirtyHint(null);
  }

  return (
    <div className="mc-stack">
      <div className="mc-sec-head">
        <div>
          <h2>{labels.modules.work}</h2>
          <p>{labels.workSub}</p>
        </div>
        <button
          type="button"
          className="mc-btn"
          onClick={() => {
            assist?.invalidateAssistApply();
            setClientDraftKey(crypto.randomUUID());
            setEditing({
              id: "",
              companyNameJa: "",
              title: "",
              startYm: formatYearMonthInputValue(
                new Date().getFullYear(),
                new Date().getMonth() + 1,
              ),
              endYm: "",
              capitalText: "",
              revenueText: "",
              employeesText: "",
              narrativeJa: "",
            });
            setDraftDirtyHint(null);
          }}
        >
          {labels.add}
        </button>
      </div>
      <div className="mc-stack">
        {employers.map((row) => (
          <article
            key={row.id}
            className="mc-card mc-card-clickable"
            role="button"
            tabIndex={0}
            onClick={() => openEmployerEditor(row)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openEmployerEditor(row);
              }
            }}
          >
            <h3 className="font-semibold text-[var(--mc-teal-deep)]">
              {row.companyNameJa}
            </h3>
            <p className="text-xs text-[var(--mc-muted)]">
              {row.startYm} — {row.endYm || "現在"} · {row.title}
            </p>
            <p className="mt-2 text-sm">
              {[row.capitalText, row.revenueText, row.employeesText]
                .filter(Boolean)
                .join(" / ")}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="mc-btn mc-btn-ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  openEmployerEditor(row);
                }}
              >
                編集
              </button>
              <button
                type="button"
                className="mc-btn mc-btn-danger"
                disabled={isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  startTransition(async () => {
                    await deleteCareerEmployerAction(row.id);
                    router.refresh();
                  });
                }}
              >
                {labels.remove}
              </button>
            </div>
          </article>
        ))}
      </div>
      {editing ? (
        <form
          key={editing.id || "new-employer"}
          action={action}
          className="mc-card mc-stack"
          data-testid="mc-employer-form"
        >
          <input type="hidden" name="id" value={editing.id} />
          <label className="mc-field">
            会社名
            <input
              name="companyName_ja"
              defaultValue={editing.companyNameJa}
              required
            />
          </label>
          <label className="mc-field">
            職位
            <input name="title" defaultValue={editing.title} />
          </label>
          <div className="mc-grid-2">
            <label className="mc-field">
              開始
              <input
                type="month"
                name="startYm"
                defaultValue={editing.startYm}
                required
              />
            </label>
            <label className="mc-field">
              終了（空=現在）
              <input type="month" name="endYm" defaultValue={editing.endYm} />
            </label>
          </div>
          <label className="mc-field">
            資本金
            <input name="capitalText" defaultValue={editing.capitalText} />
          </label>
          <label className="mc-field">
            売上高
            <input name="revenueText" defaultValue={editing.revenueText} />
          </label>
          <label className="mc-field">
            従業員数
            <input name="employeesText" defaultValue={editing.employeesText} />
          </label>
          <label className="mc-field">
            <span className="flex items-center justify-between gap-2">
              叙述
              <AiRefineButton
                fieldKey="narrative_ja"
                draftText={editing.narrativeJa}
                recordId={editing.id || null}
                clientDraftKey={editing.id ? null : clientDraftKey}
                testId="ai-refine-narrative_ja"
                getCurrentDraft={() => editingRef.current?.narrativeJa ?? ""}
                onApplyToDraft={(text) => {
                  // Click-time id is the intentional binding; live state comes from editingRef.
                  const expectedRecordId = editing.id || null;
                  if (
                    !canApplyToRecordDraft({
                      mounted: mountedRef.current,
                      editorOpen: editingRef.current != null,
                      currentRecordId: editingRef.current?.id,
                      expectedRecordId,
                    })
                  ) {
                    return false;
                  }
                  setEditing((prev) => {
                    if (
                      !prev ||
                      !canApplyToRecordDraft({
                        mounted: true,
                        editorOpen: true,
                        currentRecordId: prev.id,
                        expectedRecordId,
                      })
                    ) {
                      return prev;
                    }
                    return { ...prev, narrativeJa: text };
                  });
                  setDraftDirtyHint(tAi("applyDraftOnly"));
                  return true;
                }}
              />
            </span>
            <textarea
              name="narrative_ja"
              rows={3}
              value={editing.narrativeJa}
              data-testid="mc-employer-narrative-input"
              onChange={(e) => {
                setEditing((prev) =>
                  prev ? { ...prev, narrativeJa: e.target.value } : prev,
                );
                setDraftDirtyHint(null);
              }}
            />
          </label>
          {draftDirtyHint ? (
            <p className="text-sm text-amber-800" data-testid="mc-ai-draft-hint">
              {draftDirtyHint}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button className="mc-btn" type="submit" disabled={pending}>
              {labels.save}
            </button>
            <button
              type="button"
              className="mc-btn mc-btn-ghost"
              onClick={() => {
                assist?.invalidateAssistApply();
                setClientDraftKey(null);
                setEditing(null);
                setDraftDirtyHint(null);
              }}
            >
              閉じる
            </button>
          </div>
          <Feedback state={state} labels={labels} />
        </form>
      ) : null}
    </div>
  );
}

function ProjectsModule({
  labels,
  projects,
}: {
  labels: MyCareerLabels;
  projects: CareerProjectDto[];
}) {
  const [state, action, pending] = useActionState(saveCareerProjectAction, {});
  const [editing, setEditing] = useState<CareerProjectDto | null>(null);
  const [draftDirtyHint, setDraftDirtyHint] = useState<string | null>(null);
  const [clientDraftKey, setClientDraftKey] = useState<string | null>(null);
  const clientDraftKeyRef = useLiveRef(clientDraftKey);
  const tAi = useTranslations("AiSidebar");
  const assist = useAiAssistOptional();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const mountedRef = useRef(true);
  const editingRef = useLiveRef(editing);
  const lastRebindTokenRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      assist?.invalidateAssistApply();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount cleanup
  }, []);

  useEffect(() => {
    if (!state.ok || !state.id) return;
    const draftKey = clientDraftKeyRef.current;
    if (!draftKey) {
      setEditing((prev) => (prev ? { ...prev, id: state.id! } : prev));
      return;
    }
    const token = `${draftKey}->${state.id}`;
    if (lastRebindTokenRef.current === token) return;
    lastRebindTokenRef.current = token;
    const recordId = state.id;
    void (async () => {
      const res = await rebindAssistConversation({
        fromAssistSlotKey: assistSlotKeyForCareerProjectDraft(draftKey),
        toAssistSlotKey: assistSlotKeyForCareerProject(recordId),
        pinnedTarget: { type: "career_project", id: recordId },
      });
      if (!mountedRef.current) return;
      if ("error" in res) {
        setDraftDirtyHint(tAi("errSend"));
        return;
      }
      setClientDraftKey(null);
      setEditing((prev) => (prev ? { ...prev, id: recordId } : prev));
      router.refresh();
    })();
  }, [state, clientDraftKeyRef, router, tAi]);

  // History write-back: multi labeled + unlabeled overview-only fallback.
  useEffect(() => {
    if (!assist || !editing) return;
    const recordId = editing.id || null;
    const draftKey = clientDraftKeyRef.current;
    const slotKey = recordId
      ? assistSlotKeyForCareerProject(recordId)
      : draftKey
        ? assistSlotKeyForCareerProjectDraft(draftKey)
        : null;
    if (!slotKey) return;

    const expectedRecordId = recordId;
    const recordGuard = () =>
      canApplyToRecordDraft({
        mounted: mountedRef.current,
        editorOpen: editingRef.current != null,
        currentRecordId: editingRef.current?.id,
        expectedRecordId,
      });
    const getDrafts = () => ({
      overview: editingRef.current?.overviewJa ?? "",
      phases: editingRef.current?.phasesJa ?? "",
      responsibilities: editingRef.current?.responsibilitiesJa ?? "",
      results: editingRef.current?.resultsJa ?? "",
    });
    const applyFields = (fields: Readonly<Record<string, string>>) => {
      if (!recordGuard()) return false;
      setEditing((prev) => {
        if (
          !prev ||
          !canApplyToRecordDraft({
            mounted: true,
            editorOpen: true,
            currentRecordId: prev.id,
            expectedRecordId,
          })
        ) {
          return prev;
        }
        return {
          ...prev,
          ...(fields.overview !== undefined
            ? { overviewJa: fields.overview }
            : {}),
          ...(fields.phases !== undefined ? { phasesJa: fields.phases } : {}),
          ...(fields.responsibilities !== undefined
            ? { responsibilitiesJa: fields.responsibilities }
            : {}),
          ...(fields.results !== undefined
            ? { resultsJa: fields.results }
            : {}),
        };
      });
      setDraftDirtyHint(tAi("applyDraftOnly"));
      return true;
    };
    const applyOverviewOnly = (text: string) => {
      if (!recordGuard()) return false;
      setEditing((prev) => {
        if (
          !prev ||
          !canApplyToRecordDraft({
            mounted: true,
            editorOpen: true,
            currentRecordId: prev.id,
            expectedRecordId,
          })
        ) {
          return prev;
        }
        return { ...prev, overviewJa: text };
      });
      setDraftDirtyHint(tAi("applyDraftOnly"));
      return true;
    };

    const unbind = assist.registerLegacySlotBinder(slotKey, () => ({
      target: recordId
        ? { type: "career_project", id: recordId }
        : null,
      draftText: "",
      feature: "career_project_refine",
      fieldKey: "project_module",
      recordId,
      clientDraftKey: draftKey,
      draftSnapshot: serializeModuleDrafts(PROJECT_MODULE_FIELD_IDS, getDrafts()),
      applyMode: "multi",
      allowedFieldIds: PROJECT_MODULE_FIELD_IDS,
      limitedContext: !recordId,
      getCurrentDraft: () =>
        serializeModuleDrafts(PROJECT_MODULE_FIELD_IDS, getDrafts()),
      getCurrentDrafts: getDrafts,
      onApplyFields: applyFields,
      onApplyToDraft: applyOverviewOnly,
    }));
    return () => {
      unbind();
    };
  }, [assist, editing, editingRef, clientDraftKeyRef, tAi]);

  const empty = (): CareerProjectDto => ({
    id: "",
    titleJa: "",
    titleUrl: "",
    startYm: formatYearMonthInputValue(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
    ),
    endYm: "",
    overviewJa: "",
    phasesJa: "",
    responsibilitiesJa: "",
    resultsJa: "",
    environment: "",
    roleText: "",
    scaleText: "",
    teamSizeText: "",
    status: "confirmed",
  });

  function openProjectEditor(row: CareerProjectDto) {
    if (editingRef.current?.id !== row.id) {
      assist?.invalidateAssistApply();
    }
    setClientDraftKey(null);
    setEditing(row);
    setDraftDirtyHint(null);
  }

  return (
    <div className="mc-stack">
      <div className="mc-sec-head">
        <div>
          <h2>{labels.modules.projects}</h2>
          <p>{labels.projectsSub}</p>
        </div>
        <button
          type="button"
          className="mc-btn"
          onClick={() => {
            assist?.invalidateAssistApply();
            setClientDraftKey(crypto.randomUUID());
            setEditing(empty());
            setDraftDirtyHint(null);
          }}
        >
          {labels.add}
        </button>
      </div>
      <div className="mc-banner">{labels.projectsPendingHint}</div>
      <div className="mc-stack">
        {projects.map((row) => (
          <article
            key={row.id}
            className="mc-card mc-card-clickable"
            role="button"
            tabIndex={0}
            onClick={() => openProjectEditor(row)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openProjectEditor(row);
              }
            }}
          >
            <h3 className="font-semibold text-[var(--mc-teal-deep)]">
              {row.titleUrl ? (
                <a
                  href={row.titleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                  style={{ color: "var(--mc-link)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {row.titleJa}
                </a>
              ) : (
                row.titleJa
              )}
              {row.status === "pending_confirm" ? (
                <span className="mc-chip ml-2">{labels.pendingBadge}</span>
              ) : null}
            </h3>
            <p className="text-xs text-[var(--mc-muted)]">
              {row.startYm} — {row.endYm || "現在"} · {row.roleText}
            </p>
            <p className="mt-2 text-sm whitespace-pre-wrap">{row.overviewJa}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="mc-btn mc-btn-ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  openProjectEditor(row);
                }}
              >
                編集
              </button>
              {row.status === "pending_confirm" ? (
                <button
                  type="button"
                  className="mc-btn"
                  disabled={isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    startTransition(async () => {
                      await confirmPendingProjectAction(row.id);
                      router.refresh();
                    });
                  }}
                >
                  {labels.confirmDraft}
                </button>
              ) : null}
              <button
                type="button"
                className="mc-btn mc-btn-danger"
                disabled={isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  startTransition(async () => {
                    await deleteCareerProjectAction(row.id);
                    router.refresh();
                  });
                }}
              >
                {labels.remove}
              </button>
            </div>
          </article>
        ))}
      </div>
      {editing ? (
        <form
          key={editing.id || "new-project"}
          action={action}
          className="mc-card mc-stack"
          data-testid="mc-project-form"
        >
          <input type="hidden" name="id" value={editing.id} />
          <div className="mc-module-title-row">
            <h3 className="m-0 text-base font-semibold text-[var(--mc-teal-deep)]">
              {editing.id ? "プロジェクト編集" : "プロジェクト追加"}
            </h3>
            <AiModuleRefineButton
              kind="project"
              recordId={editing.id || null}
              clientDraftKey={editing.id ? null : clientDraftKey}
              drafts={{
                overview: editing.overviewJa,
                phases: editing.phasesJa,
                responsibilities: editing.responsibilitiesJa,
                results: editing.resultsJa,
              }}
              getCurrentDrafts={() => ({
                overview: editingRef.current?.overviewJa ?? "",
                phases: editingRef.current?.phasesJa ?? "",
                responsibilities: editingRef.current?.responsibilitiesJa ?? "",
                results: editingRef.current?.resultsJa ?? "",
              })}
              onApplyFields={(fields) => {
                const expectedRecordId = editing.id || null;
                if (
                  !canApplyToRecordDraft({
                    mounted: mountedRef.current,
                    editorOpen: editingRef.current != null,
                    currentRecordId: editingRef.current?.id,
                    expectedRecordId,
                  })
                ) {
                  return false;
                }
                setEditing((prev) => {
                  if (
                    !prev ||
                    !canApplyToRecordDraft({
                      mounted: true,
                      editorOpen: true,
                      currentRecordId: prev.id,
                      expectedRecordId,
                    })
                  ) {
                    return prev;
                  }
                  return {
                    ...prev,
                    ...(fields.overview !== undefined
                      ? { overviewJa: fields.overview }
                      : {}),
                    ...(fields.phases !== undefined
                      ? { phasesJa: fields.phases }
                      : {}),
                    ...(fields.responsibilities !== undefined
                      ? { responsibilitiesJa: fields.responsibilities }
                      : {}),
                    ...(fields.results !== undefined
                      ? { resultsJa: fields.results }
                      : {}),
                  };
                });
                setDraftDirtyHint(tAi("applyDraftOnly"));
                return true;
              }}
              onApplyToDraft={(text) => {
                const expectedRecordId = editing.id || null;
                if (
                  !canApplyToRecordDraft({
                    mounted: mountedRef.current,
                    editorOpen: editingRef.current != null,
                    currentRecordId: editingRef.current?.id,
                    expectedRecordId,
                  })
                ) {
                  return false;
                }
                setEditing((prev) => {
                  if (
                    !prev ||
                    !canApplyToRecordDraft({
                      mounted: true,
                      editorOpen: true,
                      currentRecordId: prev.id,
                      expectedRecordId,
                    })
                  ) {
                    return prev;
                  }
                  return { ...prev, overviewJa: text };
                });
                setDraftDirtyHint(tAi("applyDraftOnly"));
                return true;
              }}
            />
          </div>
          <label className="mc-field">
            タイトル
            <input name="title_ja" defaultValue={editing.titleJa} required />
          </label>
          <label className="mc-field">
            {labels.titleUrl}
            <input name="titleUrl" type="url" defaultValue={editing.titleUrl} />
          </label>
          <div className="mc-grid-2">
            <label className="mc-field">
              開始
              <input
                type="month"
                name="startYm"
                defaultValue={editing.startYm}
                required
              />
            </label>
            <label className="mc-field">
              終了
              <input type="month" name="endYm" defaultValue={editing.endYm} />
            </label>
          </div>
          <label className="mc-field">
            ステータス
            <select name="status" defaultValue={editing.status}>
              <option value="confirmed">confirmed</option>
              <option value="pending_confirm">pending_confirm</option>
            </select>
          </label>
          <label className="mc-field">
            概要
            <textarea
              name="overview_ja"
              rows={3}
              value={editing.overviewJa}
              data-testid="mc-project-overview-input"
              onChange={(e) => {
                setEditing((prev) =>
                  prev ? { ...prev, overviewJa: e.target.value } : prev,
                );
                setDraftDirtyHint(null);
              }}
            />
          </label>
          {draftDirtyHint ? (
            <p className="text-sm text-amber-800" data-testid="mc-ai-draft-hint">
              {draftDirtyHint}
            </p>
          ) : null}
          <label className="mc-field">
            担当フェーズ
            <textarea
              name="phases_ja"
              rows={2}
              value={editing.phasesJa}
              data-testid="mc-project-phases-input"
              onChange={(e) => {
                setEditing((prev) =>
                  prev ? { ...prev, phasesJa: e.target.value } : prev,
                );
                setDraftDirtyHint(null);
              }}
            />
          </label>
          <label className="mc-field">
            業務内容
            <textarea
              name="responsibilities_ja"
              rows={3}
              value={editing.responsibilitiesJa}
              data-testid="mc-project-responsibilities-input"
              onChange={(e) => {
                setEditing((prev) =>
                  prev
                    ? { ...prev, responsibilitiesJa: e.target.value }
                    : prev,
                );
                setDraftDirtyHint(null);
              }}
            />
          </label>
          <label className="mc-field">
            実績
            <textarea
              name="results_ja"
              rows={3}
              value={editing.resultsJa}
              data-testid="mc-project-results-input"
              onChange={(e) => {
                setEditing((prev) =>
                  prev ? { ...prev, resultsJa: e.target.value } : prev,
                );
                setDraftDirtyHint(null);
              }}
            />
          </label>
          <label className="mc-field">
            開発環境
            <textarea
              name="environment"
              rows={3}
              defaultValue={editing.environment}
            />
          </label>
          <label className="mc-field">
            役割
            <input name="roleText" defaultValue={editing.roleText} />
          </label>
          <label className="mc-field">
            規模
            <input name="scaleText" defaultValue={editing.scaleText} />
          </label>
          <label className="mc-field">
            チーム規模
            <input name="teamSizeText" defaultValue={editing.teamSizeText} />
          </label>
          <div className="flex gap-2">
            <button className="mc-btn" type="submit" disabled={pending}>
              {labels.save}
            </button>
            <button
              type="button"
              className="mc-btn mc-btn-ghost"
              onClick={() => {
                assist?.invalidateAssistApply();
                setClientDraftKey(null);
                setEditing(null);
                setDraftDirtyHint(null);
              }}
            >
              閉じる
            </button>
          </div>
          <Feedback state={state} labels={labels} />
        </form>
      ) : null}
    </div>
  );
}

function SkillRowMenu({
  deleteLabel,
  disabled,
  onDelete,
}: {
  deleteLabel: string;
  disabled: boolean;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="mc-row-menu" ref={rootRef}>
      <button
        type="button"
        className="mc-row-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="メニュー"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        …
      </button>
      {open ? (
        <div className="mc-row-menu-panel" role="menu">
          <button
            type="button"
            role="menuitem"
            className="mc-row-menu-item mc-row-menu-item-danger"
            disabled={disabled}
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            {deleteLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SkillAddForm({
  labels,
  onSuccess,
  onCancel,
}: {
  labels: MyCareerLabels;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(saveCareerSkillAction, {});
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && state.ok) {
      onSuccess();
    }
    wasPending.current = pending;
  }, [pending, state.ok, onSuccess]);

  return (
    <form action={action} className="mc-card mc-stack">
      <div className="mc-grid-2">
        <label className="mc-field">
          分類
          <input name="category" required />
        </label>
        <label className="mc-field">
          技術
          <input name="name" required />
        </label>
      </div>
      <label className="mc-field">
        使用期間
        <input name="yearsText" required />
      </label>
      <label className="mc-field">
        内容
        <input name="description" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button className="mc-btn" type="submit" disabled={pending}>
          {labels.add}
        </button>
        <button
          type="button"
          className="mc-btn mc-btn-ghost"
          disabled={pending}
          onClick={onCancel}
        >
          {labels.cancel}
        </button>
      </div>
      <Feedback state={state} labels={labels} />
    </form>
  );
}

function GoalAddForm({
  labels,
  onSuccess,
  onCancel,
}: {
  labels: MyCareerLabels;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(saveCareerGoalAction, {});
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && state.ok) {
      onSuccess();
    }
    wasPending.current = pending;
  }, [pending, state.ok, onSuccess]);

  return (
    <form action={action} className="mc-card mc-stack">
      <label className="mc-field">
        種類
        <select name="kind" defaultValue="short">
          <option value="short">{labels.goalShort}</option>
          <option value="long">{labels.goalLong}</option>
        </select>
      </label>
      <label className="mc-field">
        内容
        <textarea name="content_ja" rows={3} required />
      </label>
      <div className="flex flex-wrap gap-2">
        <button className="mc-btn" type="submit" disabled={pending}>
          {labels.add}
        </button>
        <button
          type="button"
          className="mc-btn mc-btn-ghost"
          disabled={pending}
          onClick={onCancel}
        >
          {labels.cancel}
        </button>
      </div>
      <Feedback state={state} labels={labels} />
    </form>
  );
}

function SkillsModule({
  labels,
  skills,
  licenses,
}: {
  labels: MyCareerLabels;
  skills: CareerSkillDto[];
  licenses: CareerLicenseDto[];
}) {
  const [editingLic, setEditingLic] = useState<CareerLicenseDto | null>(null);
  const [licPending, setLicPending] = useState(false);
  const [adding, setAdding] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const plannedRows = useMemo(() => planSkillTableRows(skills), [skills]);

  const handleAddSuccess = () => {
    setAdding(false);
    setFormKey((k) => k + 1);
    router.refresh();
  };

  const collapseAddForm = () => {
    setAdding(false);
    setFormKey((k) => k + 1);
  };

  return (
    <div className="mc-stack">
      <div className="mc-sec-head">
        <div>
          <h2>{labels.modules.skills}</h2>
          <p>{labels.skillsSub}</p>
        </div>
      </div>

      <div className="mc-skills-scroll">
        <table className="mc-skills-table">
          <colgroup>
            <col className="mc-skills-col-cat" />
            <col className="mc-skills-col-tech" />
            <col className="mc-skills-col-years" />
            <col className="mc-skills-col-desc" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">分類</th>
              <th scope="col">技術</th>
              <th scope="col">使用期間</th>
              <th scope="col">内容</th>
            </tr>
          </thead>
          <tbody>
            {plannedRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="mc-skills-empty">
                  —
                </td>
              </tr>
            ) : (
              plannedRows.map((planned) => {
                const skill = planned.skill;
                return (
                  <tr key={skill.id}>
                    {planned.categoryRowSpan !== null ? (
                      <td
                        className="mc-skills-cat"
                        rowSpan={
                          planned.categoryRowSpan >= 2
                            ? planned.categoryRowSpan
                            : undefined
                        }
                      >
                        {planned.category}
                      </td>
                    ) : null}
                    <td className="mc-skills-tech">{skill.name}</td>
                    <td className="mc-skills-years">{skill.yearsText}</td>
                    <td className="mc-skills-desc">
                      <div className="mc-skills-desc-row">
                        <span className="mc-skills-desc-text">
                          {skill.description || "—"}
                        </span>
                        <SkillRowMenu
                          deleteLabel={labels.remove}
                          disabled={isPending}
                          onDelete={() =>
                            startTransition(async () => {
                              await deleteCareerSkillAction(skill.id);
                              router.refresh();
                            })
                          }
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {adding ? (
        <SkillAddForm
          key={formKey}
          labels={labels}
          onSuccess={handleAddSuccess}
          onCancel={collapseAddForm}
        />
      ) : (
        <button
          type="button"
          className="mc-btn mc-btn-ghost mc-add-toggle"
          onClick={() => setAdding(true)}
        >
          ＋ 技能を追加
        </button>
      )}

      <div className="mc-sec-head">
        <div>
          <h3 className="m-0 text-base font-semibold text-[var(--mc-teal-deep)]">
            免許・資格
          </h3>
          <p>{labels.skillsLicensesSub}</p>
        </div>
        <button
          type="button"
          className="mc-btn"
          onClick={() =>
            setEditingLic({
              id: "",
              yearMonth: formatYearMonthInputValue(
                new Date().getFullYear(),
                12,
              ),
              nameJa: "",
            })
          }
        >
          {labels.add}
        </button>
      </div>
      <div className="mc-stack">
        {licenses.length === 0 ? (
          <p className="mc-empty">{labels.skillsLicensesEmpty}</p>
        ) : (
          licenses.map((lic) => (
            <article key={lic.id} className="mc-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[var(--mc-teal-deep)]">
                    {lic.nameJa}
                  </p>
                  <p className="text-xs text-[var(--mc-muted)]">{lic.yearMonth}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="mc-btn mc-btn-ghost"
                    onClick={() => setEditingLic(lic)}
                  >
                    {labels.edit}
                  </button>
                  <button
                    type="button"
                    className="mc-btn mc-btn-danger"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        await deleteLicenseAction(lic.id);
                        router.refresh();
                      })
                    }
                  >
                    {labels.remove}
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
      {editingLic ? (
        <form
          className="mc-card mc-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            setLicPending(true);
            startTransition(async () => {
              try {
                await saveLicenseAction(formData);
                setEditingLic(null);
                router.refresh();
              } finally {
                setLicPending(false);
              }
            });
          }}
        >
          <input type="hidden" name="id" value={editingLic.id} />
          <label className="mc-field">
            名称
            <input
              name="name_ja"
              defaultValue={editingLic.nameJa}
              required
            />
          </label>
          <label className="mc-field">
            取得年月
            <input
              type="month"
              name="yearMonth"
              defaultValue={editingLic.yearMonth}
              required
            />
          </label>
          <div className="flex gap-2">
            <button className="mc-btn" type="submit" disabled={licPending}>
              {labels.save}
            </button>
            <button
              type="button"
              className="mc-btn mc-btn-ghost"
              onClick={() => setEditingLic(null)}
            >
              閉じる
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function GoalsModule({
  labels,
  goals,
}: {
  labels: MyCareerLabels;
  goals: CareerGoalDto[];
}) {
  const [adding, setAdding] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const shortGoals = useMemo(
    () => goals.filter((g) => g.kind === "short"),
    [goals],
  );
  const longGoals = useMemo(
    () => goals.filter((g) => g.kind === "long"),
    [goals],
  );

  const handleAddSuccess = () => {
    setAdding(false);
    setFormKey((k) => k + 1);
    router.refresh();
  };

  const collapseAddForm = () => {
    setAdding(false);
    setFormKey((k) => k + 1);
  };

  return (
    <div className="mc-stack">
      <div className="mc-sec-head">
        <div>
          <h2>{labels.modules.goals}</h2>
          <p>{labels.goalsSub}</p>
        </div>
      </div>
      <div className="mc-grid-2">
        <article className="mc-card">
          <h3 className="font-semibold text-[var(--mc-teal-deep)]">
            {labels.goalShort}
          </h3>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {shortGoals.map((g) => (
              <li key={g.id} className="mb-2">
                {g.contentJa}{" "}
                <button
                  type="button"
                  className="mc-btn mc-btn-danger ml-2"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteCareerGoalAction(g.id);
                      router.refresh();
                    })
                  }
                >
                  {labels.remove}
                </button>
              </li>
            ))}
          </ul>
        </article>
        <article className="mc-card">
          <h3 className="font-semibold text-[var(--mc-teal-deep)]">
            {labels.goalLong}
          </h3>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {longGoals.map((g) => (
              <li key={g.id} className="mb-2">
                {g.contentJa}{" "}
                <button
                  type="button"
                  className="mc-btn mc-btn-danger ml-2"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteCareerGoalAction(g.id);
                      router.refresh();
                    })
                  }
                >
                  {labels.remove}
                </button>
              </li>
            ))}
          </ul>
        </article>
      </div>
      {adding ? (
        <GoalAddForm
          key={formKey}
          labels={labels}
          onSuccess={handleAddSuccess}
          onCancel={collapseAddForm}
        />
      ) : (
        <button
          type="button"
          className="mc-btn mc-btn-ghost mc-add-toggle"
          onClick={() => setAdding(true)}
        >
          ＋ 目標を追加
        </button>
      )}
    </div>
  );
}

function TimelineModule({
  labels,
  timeline,
  onJump,
}: {
  labels: MyCareerLabels;
  timeline: CareerTimelineItem[];
  onJump: (m: MyCareerModule) => void;
}) {
  const groups = useMemo(
    () => groupCareerTimelineByAt(timeline),
    [timeline],
  );

  return (
    <div className="mc-stack">
      <div className="mc-sec-head">
        <div>
          <h2>{labels.modules.timeline}</h2>
          <p>{labels.timelineSub}</p>
        </div>
      </div>
      <div className="mc-timeline">
        {groups.map((group) => (
          <div key={group.at} className="mc-tl-row">
            <p className="mc-tl-at">{group.at}</p>
            <div className="mc-tl-rail" aria-hidden />
            <div className="mc-tl-cluster">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="mc-tl-item text-left"
                  onClick={() => onJump(item.module)}
                >
                  <h3 className="text-sm font-semibold text-[var(--mc-teal-deep)]">
                    {item.title}
                  </h3>
                  {item.summary ? (
                    <p className="text-sm text-[var(--mc-muted)]">
                      {item.summary}
                    </p>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RirekishoPdfPreview({
  labels,
  reloadToken,
  onRetry,
  printRef,
  onReadyChange,
}: {
  labels: MyCareerLabels;
  reloadToken: number;
  onRetry: () => void;
  printRef: MutableRefObject<HTMLIFrameElement | null>;
  onReadyChange: (ready: boolean) => void;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;
    void (async () => {
      try {
        const res = await fetch(
          `/api/profile/export?doc=rirekisho&format=pdf&disposition=inline`,
        );
        if (!res.ok) throw new Error(`preview ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setUrl(createdUrl);
        setStatus("ready");
        onReadyChange(true);
      } catch {
        if (!cancelled) {
          setStatus("failed");
          onReadyChange(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [reloadToken, onReadyChange]);

  return (
    <div className="mc-rk-pdf-preview">
      {status === "loading" ? (
        <p className="mc-rk-pdf-status mc-no-print" role="status">
          {labels.exportPreviewLoading}
        </p>
      ) : null}
      {status === "failed" ? (
        <div className="mc-rk-pdf-status mc-no-print" role="alert">
          <p>{labels.exportPreviewFailed}</p>
          <button type="button" className="mc-btn" onClick={onRetry}>
            {labels.exportRetry}
          </button>
        </div>
      ) : null}
      {url ? (
        <iframe
          ref={printRef}
          className="mc-rk-pdf-frame"
          title={labels.exportRireki}
          src={url}
        />
      ) : null}
    </div>
  );
}

function ExportModule({
  labels,
  snapshot,
  photoUrl,
  doc,
  setDoc,
}: {
  labels: MyCareerLabels;
  snapshot: ExportSnapshot;
  photoUrl: string | null;
  doc: "rirekisho" | "shokumu";
  setDoc: (d: "rirekisho" | "shokumu") => void;
}) {
  const [busy, setBusy] = useState<"docx" | "pdf" | null>(null);
  const [error, setError] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewReady, setPreviewReady] = useState(false);
  const previewRef = useRef<HTMLIFrameElement | null>(null);
  const onReadyChange = useMemo(
    () => (ready: boolean) => setPreviewReady(ready),
    [],
  );

  async function download(format: "docx" | "pdf") {
    setBusy(format);
    setError(false);
    try {
      const res = await fetch(
        `/api/profile/export?doc=${doc}&format=${format}`,
      );
      if (!res.ok) throw new Error(`export ${res.status}`);
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
      const plain = /filename="?([^";]+)"?/i.exec(cd);
      const filename = star
        ? decodeURIComponent(star[1])
        : (plain?.[1] ?? `${doc}.${format}`);
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(href);
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  }

  function printRirekisho() {
    const frame = previewRef.current;
    if (!frame?.contentWindow || !previewReady) return;
    frame.contentWindow.focus();
    frame.contentWindow.print();
  }

  return (
    <div className="mc-stack">
      <div className="mc-sec-head">
        <div>
          <h2>{labels.modules.export}</h2>
          <p>{labels.exportSub}</p>
        </div>
        <div className="flex flex-wrap gap-2 mc-no-print">
          <button
            type="button"
            className={`mc-btn ${doc === "rirekisho" ? "" : "mc-btn-ghost"}`}
            aria-pressed={doc === "rirekisho"}
            onClick={() => {
              setPreviewReady(false);
              setDoc("rirekisho");
            }}
          >
            {labels.exportRireki}
          </button>
          <button
            type="button"
            className={`mc-btn ${doc === "shokumu" ? "" : "mc-btn-ghost"}`}
            aria-pressed={doc === "shokumu"}
            onClick={() => {
              setPreviewReady(false);
              setDoc("shokumu");
            }}
          >
            {labels.exportShokumu}
          </button>
          <button
            type="button"
            className="mc-btn"
            disabled={busy != null}
            onClick={() => void download("docx")}
          >
            {busy === "docx" ? labels.exportDownloading : labels.exportDocx}
          </button>
          <button
            type="button"
            className="mc-btn"
            disabled={busy != null}
            onClick={() => void download("pdf")}
          >
            {busy === "pdf" ? labels.exportDownloading : labels.exportPdf}
          </button>
          {doc === "rirekisho" ? (
            <button
              type="button"
              className="mc-btn mc-btn-ghost"
              disabled={!previewReady}
              onClick={() => printRirekisho()}
            >
              {labels.exportPrint}
            </button>
          ) : null}
        </div>
      </div>
      {error ? (
        <p className="text-sm text-red-700 mc-no-print" role="alert">
          {labels.exportFailed}
        </p>
      ) : null}
      {doc === "rirekisho" ? (
        <RirekishoPdfPreview
          key={previewKey}
          labels={labels}
          reloadToken={previewKey}
          onRetry={() => {
            setPreviewReady(false);
            setPreviewKey((k) => k + 1);
          }}
          printRef={previewRef}
          onReadyChange={onReadyChange}
        />
      ) : (
        <ExportSheets snapshot={snapshot} doc={doc} photoUrl={photoUrl} />
      )}
    </div>
  );
}
