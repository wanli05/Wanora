"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { SAMPLE_APPLICATIONS } from "@/lib/progress-demo/fixtures";
import {
  addInterviewToCurrent,
  addProposedSlots,
  applicationHasConflict,
  confirmProposedSlot,
  currentInterview,
  currentStage,
  detectHardConflict,
  detectOwnSlotOverlap,
  detectSlotConflict,
  formatTokyoShort,
  fromTokyoInputValue,
  isClosed,
  midCareerStages,
  nextPrepLine,
  occupiedWindows,
  passCurrentStage,
  rawOverlap,
  rejectCurrent,
  scheduledInterviews,
  stageSlots,
  toTokyoInputValue,
} from "@/lib/progress-demo/logic";
import {
  STAGE_KINDS,
  type Application,
  type InterviewMode,
  type StageKind,
} from "@/lib/progress-demo/types";
import { MonthCalendar } from "./month-calendar";

/** Frozen demo "now" so prerender does not read the real clock. */
const DEMO_NOW = new Date("2026-11-04T12:00:00+09:00");

type View = "kanban" | "list";
type Filter = "in_progress" | "closed" | "all";
type TBoard = ReturnType<typeof useTranslations<"Board">>;

const INTERVIEW_KINDS = new Set<StageKind>([
  "info_session",
  "interview_1",
  "interview_2",
  "interview_final",
]);

const PLATFORM_OPTIONS = [
  "マイナビ",
  "Doda",
  "えん転職",
  "LinkedIn",
  "企業直接応募",
];

function columnKey(kind: StageKind) {
  return `col_${kind}` as const;
}

export function ProgressBoard() {
  const t = useTranslations("Board");
  const [apps, setApps] = useState<Application[]>(SAMPLE_APPLICATIONS);
  const [view, setView] = useState<View>("kanban");
  const [filter, setFilter] = useState<Filter>("in_progress");
  const [platform, setPlatform] = useState("all");
  const [recruiter, setRecruiter] = useState("all");
  const [empty, setEmpty] = useState(false);
  const [addingApp, setAddingApp] = useState(false);
  const [interviewFor, setInterviewFor] = useState<string | null>(null);
  const [scheduleKind, setScheduleKind] = useState<"confirm" | "propose">("confirm");
  const [draftSlots, setDraftSlots] = useState([
    {
      start: toTokyoInputValue("2026-11-20T10:00:00+09:00"),
      end: toTokyoInputValue("2026-11-20T11:00:00+09:00"),
    },
    {
      start: toTokyoInputValue("2026-11-21T14:00:00+09:00"),
      end: toTokyoInputValue("2026-11-21T15:00:00+09:00"),
    },
  ]);
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const platforms = useMemo(
    () => [...new Set(apps.map((app) => app.platform))],
    [apps],
  );
  const recruiters = useMemo(
    () =>
      [...new Set(apps.map((app) => app.recruiter).filter(Boolean))] as string[],
    [apps],
  );

  const visible = empty
    ? []
    : apps.filter((app) => {
        if (filter === "in_progress" && isClosed(app)) return false;
        if (filter === "closed" && !isClosed(app)) return false;
        if (platform !== "all" && app.platform !== platform) return false;
        if (recruiter !== "all" && app.recruiter !== recruiter) return false;
        return true;
      });

  const upcoming = scheduledInterviews(visible)
    .filter((item) => new Date(item.interview.start) > DEMO_NOW)
    .sort(
      (a, b) =>
        new Date(a.interview.start).getTime() -
        new Date(b.interview.start).getTime(),
    )[0];

  const nextDeadline = visible
    .map((app) => currentStage(app)?.deadline)
    .filter((value): value is string => Boolean(value))
    .sort()[0];

  const conflictCount = visible.filter((app) =>
    applicationHasConflict(app, apps),
  ).length;

  const inProgressExists = apps.some((app) => !isClosed(app));
  const showClosedEmpty =
    !empty && visible.length === 0 && filter === "in_progress" && !inProgressExists;
  const showEmpty = empty || visible.length === 0;

  function onAddApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const company = String(form.get("company")).trim();
    if (!company) return;
    const id = `new-${Date.now()}`;
    const created: Application = {
      id,
      company,
      role: String(form.get("role") || "").trim() || undefined,
      platform: String(form.get("platform")),
      recruiter: String(form.get("recruiter") || "").trim() || null,
      appliedAt: new Date().toISOString(),
      outcome: "in_progress",
      stages: midCareerStages(id),
    };
    setApps((prev) => [...prev, created]);
    setEmpty(false);
    setAddingApp(false);
  }

  function onAddInterview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!interviewFor) return;
    const form = new FormData(event.currentTarget);
    const start = fromTokyoInputValue(String(form.get("start")));
    const end = fromTokyoInputValue(String(form.get("end")));
    const hit = detectHardConflict(apps, start, end);
    if (hit) {
      setConflictMsg(
        t("conflictWith", {
          company: hit.otherCompany,
          when: formatTokyoShort(hit.otherStart),
        }),
      );
      return;
    }
    const interview = {
      id: `iv-${Date.now()}`,
      start,
      end,
      mode: String(form.get("mode")) as InterviewMode,
      meetingUrl: String(form.get("url") || "").trim() || undefined,
      status: "scheduled" as const,
    };
    setApps((prev) =>
      prev.map((app) =>
        app.id === interviewFor ? addInterviewToCurrent(app, interview) : app,
      ),
    );
    setInterviewFor(null);
    setConflictMsg(null);
  }

  function openSchedule(appId: string, kind: "confirm" | "propose") {
    setConflictMsg(null);
    setScheduleKind(kind);
    setInterviewFor(appId);
  }

  function onAddSlots(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!interviewFor) return;
    const parsed = draftSlots
      .map((row) => ({
        start: row.start ? fromTokyoInputValue(row.start) : "",
        end: row.end ? fromTokyoInputValue(row.end) : "",
      }))
      .filter((row) => row.start && row.end);
    if (parsed.length === 0) {
      setConflictMsg(t("slotNeedOne"));
      return;
    }
    const target = apps.find((app) => app.id === interviewFor);
    if (!target) return;
    const existing = stageSlots(currentStage(target));
    for (let i = 0; i < parsed.length; i += 1) {
      const row = parsed[i];
      if (
        detectOwnSlotOverlap(existing, row.start, row.end) ||
        parsed.some(
          (other, index) =>
            index !== i && rawOverlap(row.start, row.end, other.start, other.end),
        )
      ) {
        setConflictMsg(t("slotSelfOverlap"));
        return;
      }
      const hit = detectSlotConflict(apps, row.start, row.end, {
        ignoreAppId: interviewFor,
      });
      if (hit) {
        setConflictMsg(
          `${hit.kind === "confirmed" ? t("slotConflictConfirmed") : t("slotConflictProposed")} ${t(
            "conflictWith",
            {
              company: hit.otherCompany,
              when: formatTokyoShort(hit.otherStart),
            },
          )}`,
        );
        return;
      }
    }
    setApps((prev) =>
      prev.map((app) =>
        app.id === interviewFor
          ? addProposedSlots(
              app,
              parsed.map((row, index) => ({
                id: `slot-${Date.now()}-${index}`,
                start: row.start,
                end: row.end,
              })),
            )
          : app,
      ),
    );
    setInterviewFor(null);
    setConflictMsg(null);
  }

  function onConfirmSlot(appId: string, slotId: string) {
    const app = apps.find((item) => item.id === appId);
    if (!app) return;
    const slot = stageSlots(currentStage(app)).find((item) => item.id === slotId);
    if (!slot) return;
    const hit = detectHardConflict(apps, slot.start, slot.end);
    if (hit) {
      setConflictMsg(
        t("conflictWith", {
          company: hit.otherCompany,
          when: formatTokyoShort(hit.otherStart),
        }),
      );
      return;
    }
    setApps((prev) =>
      prev.map((item) =>
        item.id === appId ? confirmProposedSlot(item, slotId) : item,
      ),
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div className="relative z-20 flex flex-wrap items-start justify-between gap-3 bg-[var(--background)]">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 max-w-3xl text-sm text-amber-800 dark:text-amber-200">
            {t("demoBanner")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="calendar-toggle"
            aria-label={t("calendar")}
            aria-expanded={calendarOpen}
            className="inline-flex h-9 w-9 items-center justify-center rounded border border-zinc-300 dark:border-zinc-700"
            onClick={() => setCalendarOpen((open) => !open)}
          >
            <CalendarIcon />
          </button>
          <button
            type="button"
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
            onClick={() => setAddingApp(true)}
          >
            {t("addApplication")}
          </button>
          <button
            type="button"
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
            onClick={() => setEmpty((value) => !value)}
          >
            {empty ? t("showSample") : t("showEmpty")}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div className="flex rounded border border-zinc-300 dark:border-zinc-700">
          <button
            type="button"
            className={`px-3 py-1 ${view === "kanban" ? "bg-zinc-200 dark:bg-zinc-800" : ""}`}
            onClick={() => setView("kanban")}
          >
            {t("viewKanban")}
          </button>
          <button
            type="button"
            className={`px-3 py-1 ${view === "list" ? "bg-zinc-200 dark:bg-zinc-800" : ""}`}
            onClick={() => setView("list")}
          >
            {t("viewList")}
          </button>
        </div>
        {(["in_progress", "closed", "all"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded px-3 py-1 ${
              filter === key
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {t(
              key === "in_progress"
                ? "filterInProgress"
                : key === "closed"
                  ? "filterClosed"
                  : "filterAll",
            )}
          </button>
        ))}
        <label className="flex items-center gap-1">
          <span className="text-zinc-500">{t("platform")}</span>
          <select
            aria-label={t("platform")}
            value={platform}
            onChange={(event) => setPlatform(event.target.value)}
            className="rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
          >
            <option value="all">{t("allPlatforms")}</option>
            {platforms.map((item) => (
              <option key={item} value={item} lang="ja">
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-zinc-500">{t("recruiter")}</span>
          <select
            aria-label={t("recruiter")}
            value={recruiter}
            onChange={(event) => setRecruiter(event.target.value)}
            className="rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
          >
            <option value="all">{t("allRecruiters")}</option>
            {recruiters.map((item) => (
              <option key={item} value={item} lang="ja">
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm md:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-900/40">
        <p>
          <span className="text-zinc-500">{t("todayNextInterview")}</span>
          {upcoming ? (
            <span lang="ja">
              {` ${upcoming.app.company} ${formatTokyoShort(upcoming.interview.start)}`}
            </span>
          ) : (
            <span>{` ${t("none")}`}</span>
          )}
        </p>
        <p>
          <span className="text-zinc-500">{t("todayNextDeadline")}</span>
          <span>
            {` ${nextDeadline ? formatTokyoShort(nextDeadline) : t("none")}`}
          </span>
        </p>
        <p className={conflictCount > 0 ? "font-medium text-red-700 dark:text-red-400" : "text-zinc-500"}>
          {t("todayConflictsCount", { count: conflictCount })}
        </p>
      </div>

      {showEmpty ? (
        <EmptyState t={t} closedFilter={showClosedEmpty} onAdd={() => setAddingApp(true)} />
      ) : view === "kanban" ? (
        <div className="flex min-h-[28rem] gap-3 overflow-x-auto pb-4">
          {STAGE_KINDS.map((kind) => {
            const cards = visible.filter((app) => currentStage(app)?.kind === kind);
            const vacant = cards.length === 0;
            return (
              <section
                key={kind}
                data-testid={`column-${kind}`}
                className={`flex shrink-0 flex-col rounded-xl border bg-zinc-50 p-2 dark:bg-zinc-900/30 ${
                  vacant
                    ? "w-40 border-zinc-200 opacity-60 dark:border-zinc-800"
                    : "w-52 border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <header className="flex items-baseline justify-between px-1 py-2">
                  <h2 className="text-sm font-medium">{t(columnKey(kind))}</h2>
                  <span className="text-xs text-zinc-500">{cards.length}</span>
                </header>
                <div className="flex flex-col gap-2">
                  {cards.map((app) => (
                    <ApplicationCard
                      key={app.id}
                      app={app}
                      apps={apps}
                      t={t}
                      onPass={() =>
                        setApps((prev) =>
                          prev.map((item) =>
                            item.id === app.id ? passCurrentStage(item) : item,
                          ),
                        )
                      }
                      onReject={() =>
                        setApps((prev) =>
                          prev.map((item) =>
                            item.id === app.id ? rejectCurrent(item) : item,
                          ),
                        )
                      }
                      onAddInterview={() => openSchedule(app.id, "confirm")}
                      onProposeSlots={() => openSchedule(app.id, "propose")}
                      onConfirmSlot={(slotId) => onConfirmSlot(app.id, slotId)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <ApplicationTable apps={visible} all={apps} t={t} />
      )}

      {addingApp ? (
        <Modal title={t("addApplication")} closeLabel={t("cancel")} onClose={() => setAddingApp(false)}>
          <form className="flex flex-col gap-3" onSubmit={onAddApplication}>
            <Field name="company" label={t("company")} required lang="ja" />
            <Field name="role" label={t("role")} lang="ja" />
            <label className="flex flex-col gap-1 text-sm">
              {t("platform")}
              <select
                name="platform"
                required
                className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              >
                {PLATFORM_OPTIONS.map((item) => (
                  <option key={item} value={item} lang="ja">
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <Field name="recruiter" label={t("recruiter")} lang="ja" />
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded px-3 py-1.5 text-sm" onClick={() => setAddingApp(false)}>
                {t("cancel")}
              </button>
              <button
                type="submit"
                className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                {t("saveApplication")}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {calendarOpen ? (
        <>
          <button
            type="button"
            data-testid="calendar-backdrop"
            aria-label={t("calendarClose")}
            className="fixed inset-0 z-10 bg-black/30"
            onClick={() => setCalendarOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("calendar")}
            className="relative z-20 rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                {t("calendarTitle", { year: 2026, month: 11 })}
              </h2>
              <button
                type="button"
                className="text-sm text-zinc-500"
                onClick={() => setCalendarOpen(false)}
              >
                {t("calendarClose")}
              </button>
            </div>
            <MonthCalendar apps={apps} year={2026} monthIndex={10} />
          </div>
        </>
      ) : null}

      {interviewFor ? (
        <Modal
          title={scheduleKind === "propose" ? t("proposeSlots") : t("addInterview")}
          closeLabel={t("cancel")}
          wide
          onClose={() => {
            setInterviewFor(null);
            setConflictMsg(null);
          }}
        >
          <div className="mb-3 flex rounded border border-zinc-300 dark:border-zinc-700">
            <button
              type="button"
              className={`flex-1 px-3 py-1 text-sm ${scheduleKind === "confirm" ? "bg-zinc-200 dark:bg-zinc-800" : ""}`}
              onClick={() => setScheduleKind("confirm")}
            >
              {t("tabConfirm")}
            </button>
            <button
              type="button"
              className={`flex-1 px-3 py-1 text-sm ${scheduleKind === "propose" ? "bg-zinc-200 dark:bg-zinc-800" : ""}`}
              onClick={() => setScheduleKind("propose")}
            >
              {t("tabPropose")}
            </button>
          </div>
          <OccupiedList apps={apps} t={t} />
          {scheduleKind === "confirm" ? (
            <form className="mt-3 flex flex-col gap-3" onSubmit={onAddInterview}>
              <label className="flex flex-col gap-1 text-sm">
                {t("mode")}
                <select
                  name="mode"
                  defaultValue="google_meet"
                  className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="google_meet">{t("modeMeet")}</option>
                  <option value="teams">{t("modeTeams")}</option>
                  <option value="other_online">{t("modeOther")}</option>
                  <option value="onsite">{t("modeOnsite")}</option>
                  <option value="phone">{t("modePhone")}</option>
                </select>
              </label>
              <Field name="url" label={t("meetingUrl")} type="url" />
              <Field
                name="start"
                label={t("start")}
                type="datetime-local"
                required
                defaultValue={toTokyoInputValue("2026-11-13T15:00:00+09:00")}
              />
              <Field
                name="end"
                label={t("end")}
                type="datetime-local"
                required
                defaultValue={toTokyoInputValue("2026-11-13T16:00:00+09:00")}
              />
              {conflictMsg ? (
                <p role="alert" className="text-sm text-red-700">
                  {`${t("conflictBlock")} ${conflictMsg}`}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded px-3 py-1.5 text-sm"
                  onClick={() => {
                    setInterviewFor(null);
                    setConflictMsg(null);
                  }}
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {t("saveInterview")}
                </button>
              </div>
            </form>
          ) : (
            <form className="mt-3 flex flex-col gap-3" onSubmit={onAddSlots}>
              {draftSlots.map((row, index) => (
                <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <Field
                    label={t("start")}
                    type="datetime-local"
                    value={row.start}
                    onChange={(event) =>
                      setDraftSlots((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, start: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <Field
                    label={t("end")}
                    type="datetime-local"
                    value={row.end}
                    onChange={(event) =>
                      setDraftSlots((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, end: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="self-end rounded px-2 py-2 text-xs text-zinc-500"
                    onClick={() =>
                      setDraftSlots((prev) => prev.filter((_, i) => i !== index))
                    }
                  >
                    {t("removeSlotRow")}
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="self-start text-sm underline"
                onClick={() =>
                  setDraftSlots((prev) => [
                    ...prev,
                    {
                      start: toTokyoInputValue("2026-11-22T10:00:00+09:00"),
                      end: toTokyoInputValue("2026-11-22T11:00:00+09:00"),
                    },
                  ])
                }
              >
                {t("addSlotRow")}
              </button>
              {conflictMsg ? (
                <p role="alert" className="text-sm text-red-700">
                  {conflictMsg}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded px-3 py-1.5 text-sm"
                  onClick={() => {
                    setInterviewFor(null);
                    setConflictMsg(null);
                  }}
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {t("saveSlots")}
                </button>
              </div>
            </form>
          )}
        </Modal>
      ) : null}
    </div>
  );
}

function ApplicationCard({
  app,
  apps,
  t,
  onPass,
  onReject,
  onAddInterview,
  onProposeSlots,
  onConfirmSlot,
}: {
  app: Application;
  apps: Application[];
  t: TBoard;
  onPass: () => void;
  onReject: () => void;
  onAddInterview: () => void;
  onProposeSlots: () => void;
  onConfirmSlot: (slotId: string) => void;
}) {
  const interview = currentInterview(app);
  const conflict = applicationHasConflict(app, apps);
  const stage = currentStage(app);
  const slots = stageSlots(stage);
  const canAddInterview = Boolean(stage && INTERVIEW_KINDS.has(stage.kind) && !interview);

  return (
    <article
      data-testid={`card-${app.id}`}
      className={`rounded-lg border bg-white p-3 shadow-sm dark:bg-zinc-950 ${
        conflict
          ? "border-l-4 border-l-red-600 border-zinc-200 dark:border-zinc-800"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold leading-snug" lang="ja">
            {app.company}
          </p>
          {app.role ? (
            <p className="text-xs text-zinc-500" lang="ja">
              {app.role}
            </p>
          ) : null}
        </div>
        <span
          className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] dark:bg-zinc-800"
          lang="ja"
        >
          {app.platform}
        </span>
      </div>
      <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400" lang="ja">
        {app.recruiter ?? t("noRecruiter")}
      </p>
      <p className="mt-2 text-sm" lang="ja">
        {nextPrepLine(app, DEMO_NOW)}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {interview ? (
          <>
            <span>{formatTokyoShort(interview.start)}</span>
            {interview.meetingUrl ? (
              <a
                href={interview.meetingUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded bg-emerald-700 px-2 py-0.5 font-medium text-white"
              >
                {t("join")}
              </a>
            ) : null}
          </>
        ) : (
          <span className="text-zinc-500">{t("unscheduled")}</span>
        )}
        {conflict ? (
          <span className="font-medium text-red-700">{t("conflict")}</span>
        ) : null}
        {app.outcome === "offer" && app.offerDecision === "pending" ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">
            {t("offerPending")}
          </span>
        ) : null}
        {slots.length > 0 ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-950">
            {t("slotCount", { count: slots.length })}
          </span>
        ) : null}
      </div>
      {slots.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs" lang="ja">
          {slots.map((slot) => (
            <li key={slot.id} className="flex items-center justify-between gap-1">
              <span>{`${formatTokyoShort(slot.start)}–${formatTokyoShort(slot.end).split(" ")[1] ?? ""}`}</span>
              {interview ? null : (
                <button
                  type="button"
                  className="underline"
                  onClick={() => onConfirmSlot(slot.id)}
                >
                  {t("confirmSlot")}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {app.outcome === "in_progress" ||
      (app.outcome === "offer" && app.offerDecision === "pending") ? (
        <div className="mt-3 flex flex-wrap gap-1">
          <button
            type="button"
            className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700"
            onClick={onPass}
          >
            {t("pass")}
          </button>
          <button
            type="button"
            className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700"
            onClick={onReject}
          >
            {t("reject")}
          </button>
          {canAddInterview ? (
            <>
              <button
                type="button"
                className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700"
                onClick={onAddInterview}
              >
                {t("addInterview")}
              </button>
              <button
                type="button"
                className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700"
                onClick={onProposeSlots}
              >
                {t("proposeSlots")}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function ApplicationTable({
  apps,
  all,
  t,
}: {
  apps: Application[];
  all: Application[];
  t: TBoard;
}) {
  const sorted = [...apps].sort((a, b) => a.company.localeCompare(b.company, "ja"));
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900">
          <tr>
            <th className="px-3 py-2 font-medium">{t("company")}</th>
            <th className="px-3 py-2 font-medium">{t("platform")}</th>
            <th className="px-3 py-2 font-medium">{t("recruiter")}</th>
            <th className="px-3 py-2 font-medium">{t("stage")}</th>
            <th className="px-3 py-2 font-medium">{t("nextPrep")}</th>
            <th className="px-3 py-2 font-medium">{t("nextInterview")}</th>
            <th className="px-3 py-2 font-medium">{t("link")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((app) => {
            const stage = currentStage(app);
            const interview = currentInterview(app);
            const conflict = applicationHasConflict(app, all);
            return (
              <tr
                key={app.id}
                className="border-t border-zinc-200 dark:border-zinc-800"
                data-testid={`row-${app.id}`}
              >
                <td className="px-3 py-2" lang="ja">
                  <span className="font-medium">{app.company}</span>
                  {conflict ? (
                    <span className="ml-2 text-xs text-red-700">{t("conflict")}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2" lang="ja">
                  {app.platform}
                </td>
                <td className="px-3 py-2" lang="ja">
                  {app.recruiter ?? t("noRecruiter")}
                </td>
                <td className="px-3 py-2">{stage ? t(columnKey(stage.kind)) : t("dash")}</td>
                <td className="px-3 py-2" lang="ja">
                  {nextPrepLine(app, DEMO_NOW)}
                </td>
                <td className="px-3 py-2">
                  {interview ? formatTokyoShort(interview.start) : t("unscheduled")}
                </td>
                <td className="px-3 py-2">
                  {interview?.meetingUrl ? (
                    <a
                      href={interview.meetingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-700 underline"
                    >
                      {t("join")}
                    </a>
                  ) : (
                    t("dash")
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({
  t,
  closedFilter,
  onAdd,
}: {
  t: TBoard;
  closedFilter: boolean;
  onAdd: () => void;
}) {
  return (
    <div
      data-testid="board-empty"
      className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700"
    >
      <h2 className="text-lg font-semibold">
        {closedFilter ? t("emptyClosed") : t("emptyTitle")}
      </h2>
      {closedFilter ? null : (
        <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">{t("emptyBody")}</p>
      )}
      <button
        type="button"
        className="rounded bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        onClick={onAdd}
      >
        {t("addApplication")}
      </button>
      <p className="text-xs text-zinc-500">{t("addRecruiter")}</p>
    </div>
  );
}

function OccupiedList({ apps, t }: { apps: Application[]; t: TBoard }) {
  const items = occupiedWindows(apps);
  return (
    <div className="max-h-40 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/40">
      <p className="mb-1 font-medium">{t("occupiedTitle")}</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={`${item.kind}-${item.company}-${item.start}`} lang="ja">
            <span className={item.kind === "confirmed" ? "text-emerald-800" : "text-amber-800"}>
              {item.kind === "confirmed" ? t("occupiedConfirmed") : t("occupiedProposed")}
            </span>
            {` ${item.company} ${formatTokyoShort(item.start)}–${formatTokyoShort(item.end).split(" ")[1] ?? ""}`}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M3 9h18M8 3v4M16 3v4" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function Modal({
  title,
  closeLabel,
  onClose,
  children,
  wide,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full rounded-xl bg-white p-5 shadow-xl dark:bg-zinc-950 ${wide ? "max-w-xl" : "max-w-md"}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" className="text-sm text-zinc-500" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  lang,
  ...input
}: { label: string; lang?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input
        {...input}
        lang={lang}
        className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      />
    </label>
  );
}
