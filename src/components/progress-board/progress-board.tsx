"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { BOARD_COLUMN_KINDS, INTERVIEW_STAGE_KINDS } from "@/lib/progress/enums";
import type {
  BoardApplication,
  BoardPayload,
  BoardStageInterview,
} from "@/lib/progress/dto";
import { interviewModeLabel } from "@/lib/progress/next-prep";
import {
  allowedAdvanceActions,
  isClosed,
  visibleBoardColumns,
} from "@/lib/progress/stages";
import { defaultFreeSlots, type DraftSlot } from "@/lib/progress/slots";
import {
  endOneHourAfter,
  formatTokyoShort,
  fromTokyoInputValue,
  toTokyoInputValue,
  tokyoNowParts,
  tokyoTodayKey,
} from "@/lib/progress/tokyo";
import { MonthCalendar } from "./month-calendar";
import { SlotGrid } from "./slot-grid";

type View = "kanban" | "list";
type Filter = "in_progress" | "closed" | "all";
type TBoard = ReturnType<typeof useTranslations<"Board">>;
type FeedbackTarget = {
  appId: string;
  company: string;
  interview: BoardStageInterview;
};

function columnKey(kind: (typeof BOARD_COLUMN_KINDS)[number]) {
  return `col_${kind}` as const;
}

function stageLabel(t: TBoard, kind: string) {
  if ((BOARD_COLUMN_KINDS as readonly string[]).includes(kind)) {
    return t(columnKey(kind as (typeof BOARD_COLUMN_KINDS)[number]));
  }
  return kind;
}

async function readJson(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error("request_failed") as Error & { body: unknown };
    err.body = body;
    throw err;
  }
  return body;
}

function platformBodyFromForm(form: FormData) {
  const customPlatformName = String(form.get("customPlatformName") || "").trim();
  if (customPlatformName) return { customPlatformName };
  return { platformId: String(form.get("platformId")) };
}

function interviewEndFromStartInput(startLocal: string) {
  return endOneHourAfter(fromTokyoInputValue(startLocal));
}

export function ProgressBoard({ initial }: { initial: BoardPayload }) {
  const t = useTranslations("Board");
  const tp = useTranslations("Platforms");
  const [board, setBoard] = useState(initial);
  const [view, setView] = useState<View>("kanban");
  const [filter, setFilter] = useState<Filter>("in_progress");
  const [platform, setPlatform] = useState("all");
  const [recruiter, setRecruiter] = useState("all");
  const [addingApp, setAddingApp] = useState(false);
  const [editingApp, setEditingApp] = useState<BoardApplication | null>(null);
  const [addingRecruiter, setAddingRecruiter] = useState(false);
  const [interviewFor, setInterviewFor] = useState<string | null>(null);
  const [feedbackFor, setFeedbackFor] = useState<FeedbackTarget | null>(null);
  const [draftSlots, setDraftSlots] = useState<DraftSlot[]>([]);
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [nowMs] = useState(() => Date.now());
  const nowParts = tokyoNowParts(new Date(nowMs));
  const [calYear, setCalYear] = useState(nowParts.year);
  const [calMonth, setCalMonth] = useState(nowParts.month);

  function closePagePanels() {
    setCalendarOpen(false);
    setInterviewFor(null);
    setFeedbackFor(null);
  }

  function openCalendar() {
    setInterviewFor(null);
    setFeedbackFor(null);
    setCalendarOpen((open) => !open);
  }

  function openFeedback(target: FeedbackTarget) {
    setCalendarOpen(false);
    setInterviewFor(null);
    setConflictMsg(null);
    setFeedbackFor(target);
  }

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(max-width: 768px)");
    const apply = () => setView(media.matches ? "list" : "kanban");
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closePagePanels();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const platformLabel = (code: string | null, name: string | null) =>
    code ? tp(code as Parameters<typeof tp>[0]) : (name ?? "");

  const apps = board.applications;
  const visible = apps.filter((app) => {
    if (filter === "in_progress" && isClosed(app.outcome, app.offerDecision)) {
      return false;
    }
    if (filter === "closed" && !isClosed(app.outcome, app.offerDecision)) {
      return false;
    }
    if (platform !== "all" && app.platformId !== platform) return false;
    if (recruiter !== "all" && app.recruiterId !== recruiter) return false;
    return true;
  });

  const upcoming = useMemo(() => {
    return apps
      .filter((app) => app.interview && new Date(app.interview.start).getTime() > nowMs)
      .sort(
        (a, b) =>
          new Date(a.interview!.start).getTime() -
          new Date(b.interview!.start).getTime(),
      )[0];
  }, [apps, nowMs]);

  const nextDeadline = visible
    .flatMap((app) => app.stages.map((stage) => stage.deadlineAt))
    .filter((value): value is string => Boolean(value))
    .sort()[0];

  const pendingSlots = apps.filter(
    (app) => app.proposal?.status === "sent" && !isClosed(app.outcome, app.offerDecision),
  ).length;
  const conflictCount = visible.filter((app) => app.conflict).length;
  const inProgressExists = apps.some((app) => !isClosed(app.outcome, app.offerDecision));
  const showClosedEmpty =
    visible.length === 0 && filter === "in_progress" && inProgressExists === false && apps.length > 0;
  const monthCount = board.occupancy.filter((item) => {
    if (item.kind !== "confirmed") return false;
    const key = item.start;
    return key.includes(
      `${calYear}-${String(calMonth).padStart(2, "0")}`,
    );
  }).length;

  async function refreshFrom(payload: BoardPayload) {
    setBoard(payload);
    setEditingApp((current) => {
      if (!current) return current;
      return payload.applications.find((app) => app.id === current.id) ?? null;
    });
    setFeedbackFor((current) => {
      if (!current) return current;
      const app = payload.applications.find((item) => item.id === current.appId);
      const interview = app?.stageInterviews.find(
        (item) => item.id === current.interview.id,
      );
      if (!app || !interview) return null;
      return { appId: app.id, company: app.company, interview };
    });
  }

  async function onAddApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const company = String(form.get("company")).trim();
    if (!company) return;
    const recruiterName = String(form.get("recruiterName") || "").trim() || null;
    try {
      const payload = await readJson(
        await fetch("/api/board/applications", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            company,
            role: String(form.get("role") || "").trim() || undefined,
            ...platformBodyFromForm(form),
            recruiterName,
            appliedOn: String(form.get("appliedOn") || "") || undefined,
            includeInfoSession: form.get("includeInfoSession") === "on",
            includeSecondInterview: form.get("includeSecondInterview") === "on",
            skipAptitude: form.get("skipAptitude") === "on",
          }),
        }),
      );
      await refreshFrom(payload);
      setAddingApp(false);
    } catch {
      setConflictMsg(t("errorGeneric"));
    }
  }

  async function onEditApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingApp) return;
    const form = new FormData(event.currentTarget);
    const company = String(form.get("company")).trim();
    if (!company) return;
    const recruiterName = String(form.get("recruiterName") || "").trim() || null;
    try {
      const payload = await readJson(
        await fetch(`/api/board/applications/${editingApp.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            company,
            role: String(form.get("role") || "").trim() || null,
            ...platformBodyFromForm(form),
            recruiterName,
            notes: String(form.get("notes") || "").trim() || null,
            appliedOn: String(form.get("appliedOn") || "") || undefined,
            companyUrl: String(form.get("companyUrl") || "").trim() || null,
            companyNotes: String(form.get("companyNotes") || "").trim() || null,
            jobUrl: String(form.get("jobUrl") || "").trim() || null,
            salaryBandText: String(form.get("salaryBandText") || "").trim() || null,
            benefitsText: String(form.get("benefitsText") || "").trim() || null,
            jdText: String(form.get("jdText") || "").trim() || null,
            processNotes: String(form.get("processNotes") || "").trim() || null,
            workLocationText:
              String(form.get("workLocationText") || "").trim() || null,
            jobNotes: String(form.get("jobNotes") || "").trim() || null,
            nextPrepNote: String(form.get("nextPrepNote") || "").trim() || null,
          }),
        }),
      );
      const start = String(form.get("start") || "");
      const url = String(form.get("url") || "").trim();
      const mode = String(form.get("mode") || "");
      if (start && mode) {
        const afterInterview = await readJson(
          await fetch(`/api/board/applications/${editingApp.id}/interviews`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              interviewId: editingApp.interview?.id,
              start: fromTokyoInputValue(start),
              end: interviewEndFromStartInput(start),
              mode,
              meetingUrl: url || undefined,
            }),
          }),
        );
        await refreshFrom(afterInterview);
      } else {
        await refreshFrom(payload);
      }
      setEditingApp(null);
      setConflictMsg(null);
    } catch (error) {
      const details = (error as { body?: { details?: { otherCompany: string; otherStart: string } } })
        .body?.details;
      setConflictMsg(
        details
          ? `${t("conflictBlock")} ${t("conflictWith", {
              company: details.otherCompany,
              when: formatTokyoShort(details.otherStart),
            })}`
          : t("errorGeneric"),
      );
    }
  }

  async function patchApp(id: string, body: unknown) {
    try {
      const payload = await readJson(
        await fetch(`/api/board/applications/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      await refreshFrom(payload);
    } catch {
      setConflictMsg(t("errorGeneric"));
    }
  }

  function openProposeSlots(appId: string) {
    setConflictMsg(null);
    setCalendarOpen(false);
    setFeedbackFor(null);
    setInterviewFor(appId);
    const existing = apps.find((app) => app.id === appId)?.proposal?.slots ?? [];
    setDraftSlots(
      existing.length > 0
        ? existing.map((slot) => ({ start: slot.start, end: slot.end }))
        : defaultFreeSlots(board.occupancy, appId),
    );
  }

  async function onSaveFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!feedbackFor) return;
    const form = new FormData(event.currentTarget);
    const ratingRaw = String(form.get("rating") || "");
    try {
      const payload = await readJson(
        await fetch(`/api/board/applications/${feedbackFor.appId}/feedback`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            interviewId: feedbackFor.interview.id,
            source: String(form.get("source")),
            body: String(form.get("body") || "").trim() || null,
            rating: ratingRaw ? Number(ratingRaw) : null,
            recordedOn: String(form.get("recordedOn") || tokyoTodayKey()),
          }),
        }),
      );
      await refreshFrom(payload);
      setFeedbackFor(null);
      setConflictMsg(null);
    } catch {
      setConflictMsg(t("errorGeneric"));
    }
  }

  async function onDeleteFeedback() {
    if (!feedbackFor?.interview.feedback) return;
    try {
      const payload = await readJson(
        await fetch(`/api/board/applications/${feedbackFor.appId}/feedback`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ interviewId: feedbackFor.interview.id }),
        }),
      );
      await refreshFrom(payload);
      setFeedbackFor(null);
    } catch {
      setConflictMsg(t("errorGeneric"));
    }
  }

  async function onAddSlots(status: "draft" | "sent") {
    if (!interviewFor) return;
    if (draftSlots.length === 0) {
      setConflictMsg(t("slotNeedOne"));
      return;
    }
    try {
      const payload = await readJson(
        await fetch(`/api/board/applications/${interviewFor}/slots`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slots: draftSlots, status }),
        }),
      );
      await refreshFrom(payload);
      setInterviewFor(null);
      setConflictMsg(null);
    } catch (error) {
      const details = (error as { body?: { details?: { otherCompany: string; otherStart: string } } })
        .body?.details;
      setConflictMsg(
        details
          ? t("conflictWith", {
              company: details.otherCompany,
              when: formatTokyoShort(details.otherStart),
            })
          : t("errorGeneric"),
      );
    }
  }

  async function onConfirmSlot(appId: string, slotId: string) {
    try {
      const payload = await readJson(
        await fetch(`/api/board/applications/${appId}/slots`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ confirmSlotId: slotId }),
        }),
      );
      await refreshFrom(payload);
    } catch (error) {
      const details = (error as { body?: { details?: { otherCompany: string; otherStart: string } } })
        .body?.details;
      setConflictMsg(
        details
          ? `${t("conflictBlock")} ${t("conflictWith", {
              company: details.otherCompany,
              when: formatTokyoShort(details.otherStart),
            })}`
          : t("conflictBlock"),
      );
    }
  }

  async function onAddRecruiter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const payload = await readJson(
        await fetch("/api/board/recruiters", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            platformId: String(form.get("platformId")),
            name: String(form.get("name")).trim(),
          }),
        }),
      );
      await refreshFrom(payload);
      setAddingRecruiter(false);
    } catch {
      setConflictMsg(t("errorGeneric"));
    }
  }

  async function onDeleteApplication() {
    if (!editingApp) return;
    if (!window.confirm(t("deleteApplicationConfirm"))) return;
    try {
      const payload = await readJson(
        await fetch(`/api/board/applications/${editingApp.id}`, {
          method: "DELETE",
        }),
      );
      await refreshFrom(payload);
      setEditingApp(null);
      setConflictMsg(null);
    } catch {
      setConflictMsg(t("errorGeneric"));
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div className="relative z-20 flex flex-wrap items-start justify-between gap-3 bg-[var(--background)]">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="calendar-toggle"
            aria-label={t("calendar")}
            aria-expanded={calendarOpen}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded border border-zinc-300 dark:border-zinc-700"
            onClick={openCalendar}
          >
            <CalendarIcon />
            {monthCount > 0 ? (
              <span className="absolute -right-1 -top-1 rounded-full bg-zinc-900 px-1 text-[10px] text-white dark:bg-zinc-100 dark:text-zinc-900">
                {monthCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
            onClick={() => setAddingApp(true)}
          >
            {t("addApplication")}
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
            {board.platforms.map((item) => (
              <option key={item.id} value={item.id} lang="ja">
                {platformLabel(item.code, item.name)}
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
            {board.recruiters.map((item) => (
              <option key={item.id} value={item.id} lang="ja">
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm md:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <p>
          <span className="text-zinc-500">{t("todayNextInterview")}</span>
          {upcoming ? (
            <span lang="ja">
              {` ${upcoming.company} ${formatTokyoShort(upcoming.interview!.start)}`}
            </span>
          ) : (
            <span>{` ${t("none")}`}</span>
          )}
        </p>
        <p>
          <span className="text-zinc-500">{t("todayPendingSlots")}</span>
          <span>{` ${pendingSlots ? t("pendingSlotCount", { count: pendingSlots }) : t("none")}`}</span>
        </p>
        <p>
          <span className="text-zinc-500">{t("todayNextDeadline")}</span>
          <span>
            {` ${nextDeadline ? formatTokyoShort(nextDeadline) : t("none")}`}
          </span>
        </p>
        {conflictCount > 0 ? (
          <p className="font-medium text-red-700 dark:text-red-400">
            {t("todayConflictsCount", { count: conflictCount })}
          </p>
        ) : (
          <p className="text-zinc-500">{t("todayConflictsCount", { count: 0 })}</p>
        )}
      </div>

      {conflictMsg && !interviewFor ? (
        <p role="alert" className="text-sm text-red-700">
          {conflictMsg}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          t={t}
          closedFilter={showClosedEmpty}
          onAdd={() => setAddingApp(true)}
          onRecruiter={() => setAddingRecruiter(true)}
        />
      ) : view === "kanban" ? (
        <div className="flex min-h-[28rem] gap-3 overflow-x-auto pb-4">
          {visibleBoardColumns(visible).map((kind) => {
            const cards = visible.filter((app) => app.currentStageKind === kind);
            const vacant = cards.length === 0;
            return (
              <section
                key={kind}
                data-testid={`column-${kind}`}
                data-occupied={vacant ? "false" : "true"}
                className={`flex shrink-0 flex-col rounded-xl border bg-zinc-50 p-2 dark:bg-zinc-900/30 ${
                  vacant
                    ? "w-36 border-zinc-200 opacity-60 dark:border-zinc-800"
                    : "w-56 border-zinc-200 dark:border-zinc-800"
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
                      platformLabel={platformLabel(app.platformCode, app.platformName)}
                      t={t}
                      onEdit={() => {
                        setConflictMsg(null);
                        setEditingApp(app);
                      }}
                      onPass={() => patchApp(app.id, { action: "pass" })}
                      onReject={() => patchApp(app.id, { action: "reject" })}
                      onWithdraw={() => patchApp(app.id, { action: "withdraw" })}
                      onOffer={() => patchApp(app.id, { action: "offer" })}
                      onAccept={() => patchApp(app.id, { action: "accept_offer" })}
                      onDecline={() => patchApp(app.id, { action: "decline_offer" })}
                      onProposeSlots={() => openProposeSlots(app.id)}
                      onConfirmSlot={(slotId) => onConfirmSlot(app.id, slotId)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <ApplicationTable
          apps={visible}
          t={t}
          platformLabel={(app) => platformLabel(app.platformCode, app.platformName)}
          onEdit={(app) => {
            setConflictMsg(null);
            setEditingApp(app);
          }}
        />
      )}

      {addingApp ? (
        <Modal title={t("addApplication")} closeLabel={t("cancel")} onClose={() => setAddingApp(false)}>
          <AddApplicationForm
            t={t}
            platforms={board.platforms}
            platformLabel={platformLabel}
            onSubmit={onAddApplication}
            onCancel={() => setAddingApp(false)}
          />
        </Modal>
      ) : null}

      {editingApp ? (
        <Modal
          title={t("editApplication")}
          wide
          headerAction={{
            label: t("deleteApplication"),
            onClick: onDeleteApplication,
            className: "text-sm text-red-700 dark:text-red-400",
            testId: "delete-application",
          }}
        >
          <AddApplicationForm
            t={t}
            platforms={board.platforms}
            platformLabel={platformLabel}
            initial={editingApp}
            conflictMsg={conflictMsg}
            onSubmit={onEditApplication}
            onOpenFeedback={(interview) =>
              openFeedback({
                appId: editingApp.id,
                company: editingApp.company,
                interview,
              })
            }
            onCancel={() => {
              setEditingApp(null);
              setConflictMsg(null);
            }}
          />
        </Modal>
      ) : null}

      {addingRecruiter ? (
        <Modal title={t("addRecruiter")} closeLabel={t("cancel")} onClose={() => setAddingRecruiter(false)}>
          <form className="flex flex-col gap-3" onSubmit={onAddRecruiter}>
            <label className="flex flex-col gap-1 text-sm">
              {t("platform")}
              <select
                name="platformId"
                required
                className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              >
                {board.platforms.map((item) => (
                  <option key={item.id} value={item.id} lang="ja">
                    {platformLabel(item.code, item.name)}
                  </option>
                ))}
              </select>
            </label>
            <Field name="name" label={t("recruiterName")} required lang="ja" />
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded px-3 py-1.5 text-sm" onClick={() => setAddingRecruiter(false)}>
                {t("cancel")}
              </button>
              <button
                type="submit"
                className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                {t("saveRecruiter")}
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
                {t("calendarTitle", { year: calYear, month: calMonth })}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700"
                  onClick={() => {
                    const next = calMonth === 1 ? 12 : calMonth - 1;
                    setCalMonth(next);
                    if (calMonth === 1) setCalYear(calYear - 1);
                  }}
                >
                  {t("calendarPrev")}
                </button>
                <button
                  type="button"
                  className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700"
                  onClick={() => {
                    const next = calMonth === 12 ? 1 : calMonth + 1;
                    setCalMonth(next);
                    if (calMonth === 12) setCalYear(calYear + 1);
                  }}
                >
                  {t("calendarNext")}
                </button>
                <button
                  type="button"
                  className="text-sm text-zinc-500"
                  onClick={() => setCalendarOpen(false)}
                >
                  {t("calendarClose")}
                </button>
              </div>
            </div>
            <MonthCalendar occupancy={board.occupancy} year={calYear} monthIndex={calMonth - 1} />
          </div>
        </>
      ) : null}

      {interviewFor ? (
        <>
          <button
            type="button"
            data-testid="slot-grid-backdrop"
            aria-label={t("cancel")}
            className="fixed inset-0 z-10 bg-black/30"
            onClick={() => {
              setInterviewFor(null);
              setConflictMsg(null);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("proposeSlots")}
            className="relative z-20 rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{t("proposeSlots")}</h2>
              <button
                type="button"
                className="text-sm text-zinc-500"
                onClick={() => {
                  setInterviewFor(null);
                  setConflictMsg(null);
                }}
              >
                {t("cancel")}
              </button>
            </div>
            <SlotGrid
              key={interviewFor}
              occupancy={board.occupancy}
              appId={interviewFor}
              company={apps.find((app) => app.id === interviewFor)?.company ?? ""}
              drafts={draftSlots}
              onChange={(next) => {
                setConflictMsg(null);
                setDraftSlots(next);
              }}
              onConflict={setConflictMsg}
            />
            {conflictMsg ? (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {conflictMsg}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
                onClick={() => onAddSlots("draft")}
              >
                {t("saveDraftSlots")}
              </button>
              <button
                type="button"
                className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
                onClick={() => onAddSlots("sent")}
              >
                {t("saveSlots")}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {feedbackFor ? (
        <>
          <button
            type="button"
            data-testid="feedback-backdrop"
            aria-label={t("cancel")}
            className="fixed inset-0 z-30 bg-black/30"
            onClick={() => {
              setFeedbackFor(null);
              setConflictMsg(null);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("feedbackTitle")}
            data-testid="feedback-panel"
            className="fixed inset-x-4 top-16 z-40 mx-auto max-h-[85vh] max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950 md:inset-x-auto md:right-8"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{t("feedbackTitle")}</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400" lang="ja">
                  {`${feedbackFor.company} · ${stageLabel(
                    t,
                    feedbackFor.interview.stageKind,
                  )} · ${formatTokyoShort(feedbackFor.interview.start)} · ${interviewModeLabel(
                    feedbackFor.interview.mode,
                  )}`}
                </p>
              </div>
              <button
                type="button"
                className="text-sm text-zinc-500"
                onClick={() => {
                  setFeedbackFor(null);
                  setConflictMsg(null);
                }}
              >
                {t("cancel")}
              </button>
            </div>
            <FeedbackForm
              t={t}
              interview={feedbackFor.interview}
              conflictMsg={conflictMsg}
              onSubmit={onSaveFeedback}
              onDelete={
                feedbackFor.interview.feedback ? onDeleteFeedback : undefined
              }
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function AddApplicationForm({
  t,
  platforms,
  platformLabel,
  initial,
  conflictMsg,
  onSubmit,
  onCancel,
  onOpenFeedback,
}: {
  t: TBoard;
  platforms: BoardPayload["platforms"];
  platformLabel: (code: string | null, name: string | null) => string;
  initial?: BoardApplication;
  conflictMsg?: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  onOpenFeedback?: (interview: BoardStageInterview) => void;
}) {
  const [platformId, setPlatformId] = useState(
    initial?.platformId ?? platforms[0]?.id ?? "",
  );
  const selectedPlatform = platforms.find((item) => item.id === platformId);
  const showCustomPlatform = selectedPlatform?.code === "other";
  const canEditInterview = Boolean(
    initial &&
      (initial.interview ||
        (initial.currentStageKind &&
          INTERVIEW_STAGE_KINDS.has(initial.currentStageKind))),
  );
  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <Field
        name="company"
        label={t("company")}
        required
        lang="ja"
        defaultValue={initial?.company ?? ""}
      />
      <Field name="role" label={t("role")} lang="ja" defaultValue={initial?.role ?? ""} />
      <label className="flex flex-col gap-1 text-sm">
        {t("platform")}
        <select
          name="platformId"
          required
          value={platformId}
          onChange={(event) => setPlatformId(event.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {platforms.map((item) => (
            <option key={item.id} value={item.id} lang="ja">
              {platformLabel(item.code, item.name)}
            </option>
          ))}
        </select>
      </label>
      {showCustomPlatform ? (
        <label className="flex flex-col gap-1 text-sm">
          {t("customPlatform")}
          <input
            name="customPlatformName"
            lang="ja"
            placeholder={t("customPlatformPlaceholder")}
            defaultValue=""
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      ) : null}
      <Field
        name="recruiterName"
        label={t("recruiter")}
        lang="ja"
        defaultValue={initial?.recruiterName ?? ""}
      />
      <Field
        name="appliedOn"
        label={t("appliedOn")}
        type="date"
        defaultValue={initial?.appliedOn ?? ""}
      />
      {initial ? (
        <>
          <section
            data-testid="company-section"
            className="space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
          >
            <h3 className="text-sm font-medium">{t("companySection")}</h3>
            <Field
              name="companyUrl"
              label={t("companyUrl")}
              type="url"
              defaultValue={initial.companyUrl ?? ""}
            />
            <label className="flex flex-col gap-1 text-sm">
              {t("companyNotes")}
              <textarea
                name="companyNotes"
                lang="ja"
                defaultValue={initial.companyNotes ?? ""}
                rows={2}
                className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
          </section>
          <section
            data-testid="job-posting-section"
            className="space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
          >
            <h3 className="text-sm font-medium">{t("jobPostingSection")}</h3>
            <Field
              name="jobUrl"
              label={t("jobUrl")}
              type="url"
              defaultValue={initial.jobPosting.jobUrl ?? ""}
            />
            <Field
              name="salaryBandText"
              label={t("salaryBand")}
              lang="ja"
              defaultValue={initial.jobPosting.salaryBandText ?? ""}
            />
            <Field
              name="workLocationText"
              label={t("workLocation")}
              lang="ja"
              defaultValue={initial.jobPosting.workLocationText ?? ""}
            />
            <label className="flex flex-col gap-1 text-sm">
              {t("benefits")}
              <textarea
                name="benefitsText"
                lang="ja"
                defaultValue={initial.jobPosting.benefitsText ?? ""}
                rows={2}
                className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t("jdText")}
              <textarea
                name="jdText"
                lang="ja"
                defaultValue={initial.jobPosting.jdText ?? ""}
                rows={3}
                className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t("processNotes")}
              <textarea
                name="processNotes"
                lang="ja"
                defaultValue={initial.jobPosting.processNotes ?? ""}
                rows={2}
                className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t("jobNotes")}
              <textarea
                name="jobNotes"
                lang="ja"
                defaultValue={initial.jobPosting.jobNotes ?? ""}
                rows={2}
                className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
          </section>
          <label className="flex flex-col gap-1 text-sm">
            {t("nextPrep")}
            <textarea
              name="nextPrepNote"
              lang="ja"
              defaultValue={initial.nextPrepNote ?? ""}
              rows={2}
              className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t("notes")}
            <textarea
              name="notes"
              lang="ja"
              defaultValue={initial.notes ?? ""}
              rows={2}
              className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <section
            data-testid="stage-interviews-section"
            className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
          >
            <h3 className="text-sm font-medium">{t("stageInterviews")}</h3>
            {initial.stageInterviews.length === 0 ? (
              <p className="text-sm text-zinc-500">{t("noStageInterviews")}</p>
            ) : (
              <ul className="space-y-2">
                {initial.stageInterviews.map((interview) => (
                  <li
                    key={interview.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-100 px-2 py-2 text-sm dark:border-zinc-800"
                  >
                    <div lang="ja">
                      <p>
                        {`${stageLabel(t, interview.stageKind)} · ${formatTokyoShort(
                          interview.start,
                        )}`}
                      </p>
                      {interview.feedback ? (
                        <p className="text-xs text-zinc-500">
                          {interview.feedback.summary}
                        </p>
                      ) : null}
                    </div>
                    {interview.feedback || interview.canWriteFeedback ? (
                      <button
                        type="button"
                        className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700"
                        onClick={() => onOpenFeedback?.(interview)}
                      >
                        {interview.feedback
                          ? t("editFeedback")
                          : t("writeFeedback")}
                      </button>
                    ) : interview.status === "scheduled" ? (
                      <span className="text-xs text-zinc-500">
                        {t("feedbackTooEarly")}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="includeInfoSession" />
            {t("includeInfoSession")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="includeSecondInterview" />
            {t("includeSecondInterview")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="skipAptitude" />
            {t("skipAptitude")}
          </label>
        </>
      )}
      {canEditInterview ? (
        <>
          <label className="flex flex-col gap-1 text-sm">
            {t("mode")}
            <select
              name="mode"
              defaultValue={initial?.interview?.mode ?? "google_meet"}
              className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="google_meet">{t("modeMeet")}</option>
              <option value="teams">{t("modeTeams")}</option>
              <option value="other_online">{t("modeOther")}</option>
              <option value="onsite">{t("modeOnsite")}</option>
              <option value="phone">{t("modePhone")}</option>
            </select>
          </label>
          <Field
            name="url"
            label={t("meetingUrl")}
            type="url"
            defaultValue={initial?.interview?.meetingUrl ?? ""}
          />
          <Field
            name="start"
            label={t("start")}
            type="datetime-local"
            defaultValue={
              initial?.interview
                ? toTokyoInputValue(initial.interview.start)
                : ""
            }
          />
        </>
      ) : null}
      {conflictMsg ? (
        <p role="alert" className="text-sm text-red-700">
          {conflictMsg}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <button type="button" className="rounded px-3 py-1.5 text-sm" onClick={onCancel}>
          {t("cancel")}
        </button>
        <button
          type="submit"
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          {initial ? t("saveEdits") : t("saveApplication")}
        </button>
      </div>
    </form>
  );
}

function FeedbackForm({
  t,
  interview,
  conflictMsg,
  onSubmit,
  onDelete,
}: {
  t: TBoard;
  interview: BoardStageInterview;
  conflictMsg?: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete?: () => void;
}) {
  const existing = interview.feedback;
  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <label className="flex flex-col gap-1 text-sm">
        {t("feedbackSource")}
        <select
          name="source"
          required
          defaultValue={existing?.source ?? "company"}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="company">{t("feedbackSourceCompany")}</option>
          <option value="recruiter">{t("feedbackSourceRecruiter")}</option>
          <option value="self">{t("feedbackSourceSelf")}</option>
        </select>
      </label>
      <Field
        name="recordedOn"
        label={t("feedbackRecordedOn")}
        type="date"
        required
        defaultValue={existing?.recordedOn ?? tokyoTodayKey()}
      />
      <label className="flex flex-col gap-1 text-sm">
        {t("feedbackRating")}
        <select
          name="rating"
          defaultValue={existing?.rating?.toString() ?? ""}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">{t("feedbackEmptyRating")}</option>
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("feedbackBody")}
        <textarea
          name="body"
          lang="ja"
          rows={5}
          defaultValue={existing?.body ?? ""}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      {conflictMsg ? (
        <p role="alert" className="text-sm text-red-700">
          {conflictMsg}
        </p>
      ) : null}
      <div className="flex justify-between gap-2">
        {onDelete ? (
          <button
            type="button"
            className="rounded px-3 py-1.5 text-sm text-red-700"
            onClick={onDelete}
          >
            {t("feedbackDelete")}
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          {t("feedbackSave")}
        </button>
      </div>
    </form>
  );
}

function ApplicationCard({
  app,
  platformLabel,
  t,
  onEdit,
  onPass,
  onReject,
  onWithdraw,
  onOffer,
  onAccept,
  onDecline,
  onProposeSlots,
  onConfirmSlot,
}: {
  app: BoardApplication;
  platformLabel: string;
  t: TBoard;
  onEdit: () => void;
  onPass: () => void;
  onReject: () => void;
  onWithdraw: () => void;
  onOffer: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onProposeSlots: () => void;
  onConfirmSlot: (slotId: string) => void;
}) {
  const interview = app.interview;
  const modeLabel = interview ? interviewModeLabel(interview.mode) : "";
  const canSchedule = Boolean(
    app.currentStageKind && INTERVIEW_STAGE_KINDS.has(app.currentStageKind),
  );
  const stageActions = app.currentStageKind
    ? allowedAdvanceActions(app.currentStageKind)
    : [];
  const offerPending = app.outcome === "offer" && app.offerDecision === "pending";
  const inPlay = app.outcome === "in_progress" || offerPending;

  return (
    <article
      data-testid={`card-${app.id}`}
      className={`rounded-lg border bg-white p-3 shadow-sm dark:bg-zinc-950 ${
        app.conflict
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
        <button
          type="button"
          data-testid={`edit-${app.id}`}
          className="shrink-0 rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700"
          onClick={onEdit}
        >
          {t("editCard")}
        </button>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
        <span
          className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
          lang="ja"
        >
          {platformLabel}
        </span>
        <span lang="ja">{app.recruiterName ?? t("noRecruiter")}</span>
      </p>
      {app.hasJobPosting || app.hasFeedback ? (
        <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
          {app.hasJobPosting ? (
            <span
              data-testid={`badge-job-${app.id}`}
              className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-900 dark:bg-sky-950 dark:text-sky-100"
            >
              {t("badgeJobPosting")}
            </span>
          ) : null}
          {app.hasFeedback ? (
            <span
              data-testid={`badge-feedback-${app.id}`}
              className="rounded bg-violet-50 px-1.5 py-0.5 text-violet-900 dark:bg-violet-950 dark:text-violet-100"
            >
              {t("badgeFeedback")}
            </span>
          ) : null}
        </div>
      ) : null}
      <p className="mt-2 text-sm" lang="ja">
        {app.nextPrep}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {interview ? (
          <>
            <span>{formatTokyoShort(interview.start)}</span>
            {modeLabel ? <span className="text-zinc-500">{modeLabel}</span> : null}
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
        ) : app.proposal?.status === "sent" ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-950">
            {t("slotCount", { count: app.proposal.slots.length })}
          </span>
        ) : app.proposal?.status === "draft" ? (
          <span className="rounded bg-zinc-100 px-1.5 py-0.5">
            {t("slotDraftCount", { count: app.proposal.slots.length })}
          </span>
        ) : (
          <span className="text-zinc-500">{t("unscheduled")}</span>
        )}
        {app.conflict ? (
          <span className="font-medium text-red-700">{t("conflict")}</span>
        ) : null}
        {offerPending ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">
            {t("offerPending")}
          </span>
        ) : null}
      </div>
      {app.proposal && app.proposal.slots.length > 0 && !interview ? (
        <ul className="mt-2 space-y-1 text-xs" lang="ja">
          {app.proposal.slots.map((slot) => (
            <li key={slot.id} className="flex items-center justify-between gap-1">
              <span>{`${formatTokyoShort(slot.start)}–${formatTokyoShort(slot.end).split(" ")[1] ?? ""}`}</span>
              {app.proposal?.status === "sent" ? (
                <button
                  type="button"
                  className="underline"
                  onClick={() => onConfirmSlot(slot.id)}
                >
                  {t("confirmSlot")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-1">
        {inPlay ? (
          offerPending ? (
            <>
              <button
                type="button"
                className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700"
                onClick={onAccept}
              >
                {t("acceptOffer")}
              </button>
              <button
                type="button"
                className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700"
                onClick={onDecline}
              >
                {t("declineOffer")}
              </button>
            </>
          ) : (
            <>
              {stageActions.includes("pass") ? (
                <button
                  type="button"
                  data-testid="action-pass"
                  className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700"
                  onClick={onPass}
                >
                  {app.currentStageKind === "info_session" ? t("advanceNext") : t("pass")}
                </button>
              ) : null}
              {stageActions.includes("reject") ? (
                <button
                  type="button"
                  data-testid="action-reject"
                  className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700"
                  onClick={onReject}
                >
                  {t("reject")}
                </button>
              ) : null}
              {stageActions.includes("withdraw") ? (
                <button
                  type="button"
                  data-testid="action-withdraw"
                  className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700"
                  onClick={onWithdraw}
                >
                  {t("withdraw")}
                </button>
              ) : null}
              {stageActions.includes("offer") ? (
                <button
                  type="button"
                  data-testid="action-offer"
                  className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700"
                  onClick={onOffer}
                >
                  {t("markOffer")}
                </button>
              ) : null}
            </>
          )
        ) : null}
        {inPlay && canSchedule && !interview ? (
          <button
            type="button"
            className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700"
            onClick={onProposeSlots}
          >
            {t("proposeSlots")}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function ApplicationTable({
  apps,
  t,
  platformLabel,
  onEdit,
}: {
  apps: BoardApplication[];
  t: TBoard;
  platformLabel: (app: BoardApplication) => string;
  onEdit: (app: BoardApplication) => void;
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
            <th className="px-3 py-2 font-medium">{t("editCard")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((app) => (
            <tr
              key={app.id}
              className="border-t border-zinc-200 dark:border-zinc-800"
              data-testid={`row-${app.id}`}
            >
              <td className="px-3 py-2" lang="ja">
                <span className="font-medium">{app.company}</span>
                {app.conflict ? (
                  <span className="ml-2 text-xs text-red-700">{t("conflict")}</span>
                ) : null}
              </td>
              <td className="px-3 py-2" lang="ja">
                {platformLabel(app)}
              </td>
              <td className="px-3 py-2" lang="ja">
                {app.recruiterName ?? t("noRecruiter")}
              </td>
              <td className="px-3 py-2">
                {app.currentStageKind
                  ? t(columnKey(app.currentStageKind as (typeof BOARD_COLUMN_KINDS)[number]))
                  : t("dash")}
              </td>
              <td className="px-3 py-2" lang="ja">
                {app.nextPrep}
              </td>
              <td className="px-3 py-2">
                {app.interview ? formatTokyoShort(app.interview.start) : t("unscheduled")}
              </td>
              <td className="px-3 py-2">
                {app.interview?.meetingUrl ? (
                  <a
                    href={app.interview.meetingUrl}
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
              <td className="px-3 py-2">
                <button
                  type="button"
                  className="underline"
                  onClick={() => onEdit(app)}
                >
                  {t("editCard")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({
  t,
  closedFilter,
  onAdd,
  onRecruiter,
}: {
  t: TBoard;
  closedFilter: boolean;
  onAdd: () => void;
  onRecruiter: () => void;
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
      <button type="button" className="text-xs text-zinc-500 underline" onClick={onRecruiter}>
        {t("addRecruiter")}
      </button>
      <p className="text-xs text-zinc-500">{t("addRecruiterHint")}</p>
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
  headerAction,
  children,
  wide = false,
}: {
  title: string;
  closeLabel?: string;
  onClose?: () => void;
  headerAction?: {
    label: string;
    onClick: () => void;
    className?: string;
    testId?: string;
  };
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white p-5 shadow-xl dark:bg-zinc-950 ${
          wide ? "max-w-2xl" : "max-w-md"
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          {headerAction ? (
            <button
              type="button"
              data-testid={headerAction.testId}
              className={headerAction.className ?? "text-sm text-zinc-500"}
              onClick={headerAction.onClick}
            >
              {headerAction.label}
            </button>
          ) : (
            <button
              type="button"
              className="text-sm text-zinc-500"
              onClick={onClose}
            >
              {closeLabel}
            </button>
          )}
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
