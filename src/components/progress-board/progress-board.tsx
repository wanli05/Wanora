"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { BOARD_COLUMN_KINDS, INTERVIEW_STAGE_KINDS } from "@/lib/progress/enums";
import type {
  BoardApplication,
  BoardFeedback,
  BoardPayload,
  BoardStageInterview,
} from "@/lib/progress/dto";
import { interviewModeLabel } from "@/lib/progress/next-prep";
import {
  allowedAdvanceActions,
  canUndoAdvance,
  isClosed,
  visibleBoardColumns,
} from "@/lib/progress/stages";
import { defaultFreeSlots, type DraftSlot } from "@/lib/progress/slots";
import {
  appTaskFlags,
  countTaskFocus,
  feedbackPendingAlert,
  type TaskFocus,
} from "@/lib/progress/task-focus";
import {
  endOneHourAfter,
  formatTokyoShort,
  fromTokyoInputValue,
  toTokyoInputValue,
  tokyoNowParts,
  tokyoTodayKey,
} from "@/lib/progress/tokyo";
import type { BoardFeedbackQaItem } from "@/lib/progress/dto";
import { MonthCalendar } from "./month-calendar";
import { SlotGrid } from "./slot-grid";

type View = "kanban" | "list";
type Filter = "in_progress" | "closed" | "all";
type EditSection = "basic" | "company" | "job" | "history";
type TBoard = ReturnType<typeof useTranslations<"Board">>;
type FeedbackTarget = {
  appId: string;
  company: string;
  interview: BoardStageInterview;
  /** When set, the panel edits that feedback; otherwise it appends a new one. */
  editing?: BoardFeedback | null;
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
  const [menuAppId, setMenuAppId] = useState<string | null>(null);
  const [passConfirm, setPassConfirm] = useState<BoardApplication | null>(null);
  const [prepApp, setPrepApp] = useState<BoardApplication | null>(null);
  const [taskFocus, setTaskFocus] = useState<TaskFocus | null>(null);
  const [editSection, setEditSection] = useState<EditSection>("basic");

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
        setMenuAppId(null);
        setPassConfirm(null);
        setPrepApp(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function onDocClick() {
      setMenuAppId(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
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

  const taskCounts = useMemo(
    () => countTaskFocus(apps, nowMs),
    [apps, nowMs],
  );
  const alertApp = useMemo(
    () => feedbackPendingAlert(apps, nowMs),
    [apps, nowMs],
  );
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
      const editing = current.editing
        ? (interview.feedbacks.find((item) => item.id === current.editing?.id) ?? null)
        : null;
      return {
        appId: app.id,
        company: app.company,
        interview,
        editing,
      };
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

  async function onSaveFeedback(
    event: FormEvent<HTMLFormElement>,
    qaItems: BoardFeedbackQaItem[],
  ) {
    event.preventDefault();
    if (!feedbackFor) return;
    const form = new FormData(event.currentTarget);
    const body = String(form.get("body") || "").trim() || null;
    const resultText = String(form.get("resultText") || "").trim() || null;
    const reflection = String(form.get("reflection") || "").trim() || null;
    const hasQa = qaItems.some((item) => item.question || item.answer);
    if (!body && !resultText && !reflection && !hasQa) {
      setConflictMsg(t("feedbackBodyRequired"));
      return;
    }
    try {
      const payload = await readJson(
        await fetch(`/api/board/applications/${feedbackFor.appId}/feedback`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            interviewId: feedbackFor.interview.id,
            ...(feedbackFor.editing?.id
              ? { feedbackId: feedbackFor.editing.id }
              : {}),
            source: String(form.get("source")),
            body,
            qaItems,
            resultText,
            reflection,
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
    if (!feedbackFor?.editing) return;
    try {
      const payload = await readJson(
        await fetch(`/api/board/applications/${feedbackFor.appId}/feedback`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ feedbackId: feedbackFor.editing.id }),
        }),
      );
      await refreshFrom(payload);
      setFeedbackFor(null);
      setConflictMsg(null);
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
    <div className="pb-shell flex flex-1 flex-col">
      <div className="pb-nav" role="navigation" aria-label={t("title")}>
        <h1 className="pb-nav-title">{t("title")}</h1>
        <button
          type="button"
          className="pb-nav-link"
          data-active={!calendarOpen && view === "kanban" ? "true" : "false"}
          onClick={() => {
            setCalendarOpen(false);
            setView("kanban");
          }}
        >
          {t("viewKanban")}
        </button>
        <button
          type="button"
          className="pb-nav-link"
          data-active={!calendarOpen && view === "list" ? "true" : "false"}
          onClick={() => {
            setCalendarOpen(false);
            setView("list");
          }}
        >
          {t("viewList")}
        </button>
        <button
          type="button"
          data-testid="calendar-toggle"
          aria-label={t("calendar")}
          aria-expanded={calendarOpen}
          aria-pressed={calendarOpen}
          className="pb-nav-link relative"
          data-active={calendarOpen ? "true" : "false"}
          onClick={openCalendar}
        >
          {t("calendar")}
          {monthCount > 0 ? (
            <span className="ml-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-[var(--pb-teal-deep)] px-1 text-[10px] font-semibold text-white">
              {monthCount}
            </span>
          ) : null}
        </button>
        <span className="pb-nav-spacer" />
        <button
          type="button"
          className="pb-btn pb-btn-sm"
          onClick={() => setAddingApp(true)}
        >
          {t("addApplication")}
        </button>
      </div>

      <div className="pb-main">
      {calendarOpen ? (
        <section
          className="pb-board-slot pb-cal-panel"
          data-testid="calendar-panel"
          aria-label={t("calendar")}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2>{t("calendarTitle", { year: calYear, month: calMonth })}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="pb-btn pb-btn-ghost pb-btn-sm"
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
                className="pb-btn pb-btn-ghost pb-btn-sm"
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
                className="pb-nav-link"
                onClick={() => setCalendarOpen(false)}
              >
                {t("calendarClose")}
              </button>
            </div>
          </div>
          <MonthCalendar
            occupancy={board.occupancy}
            year={calYear}
            monthIndex={calMonth - 1}
          />
        </section>
      ) : (
        <>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {(["in_progress", "closed", "all"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-lg px-3 py-1 ${
              filter === key
                ? "bg-[var(--pb-teal-deep)] text-white"
                : "border border-[var(--pb-line)] bg-[var(--pb-card)]"
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
          <span className="text-[var(--pb-muted)]">{t("platform")}</span>
          <select
            aria-label={t("platform")}
            value={platform}
            onChange={(event) => setPlatform(event.target.value)}
            className="rounded-lg border border-[var(--pb-line)] bg-[var(--pb-card)] px-2 py-1"
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
          <span className="text-[var(--pb-muted)]">{t("recruiter")}</span>
          <select
            aria-label={t("recruiter")}
            value={recruiter}
            onChange={(event) => setRecruiter(event.target.value)}
            className="rounded-lg border border-[var(--pb-line)] bg-[var(--pb-card)] px-2 py-1"
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

      <section className="pb-task-bar" aria-label={t("title")} data-testid="task-bar">
        <div className="pb-task-stats">
          {(
            [
              ["interview", "taskInterview"],
              ["waiting", "taskWaiting"],
              ["overdue", "taskOverdue"],
              ["overlap", "taskOverlap"],
            ] as const
          ).map(([key, labelKey]) => (
            <button
              key={key}
              type="button"
              className="pb-stat"
              data-testid={`task-stat-${key}`}
              data-active={taskFocus === key ? "true" : "false"}
              onClick={() =>
                setTaskFocus((current) => (current === key ? null : key))
              }
            >
              <div className="pb-label">{t(labelKey)}</div>
              <div
                className="pb-num"
                data-danger={key === "overdue" && taskCounts[key] > 0 ? "true" : "false"}
              >
                {taskCounts[key]}
              </div>
              <div className="pb-unit">{t("taskUnit")}</div>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="pb-task-alert"
          data-testid="task-alert"
          onClick={() => {
            if (alertApp) {
              setTaskFocus("interview");
              setConflictMsg(null);
              setEditingApp(alertApp);
              setEditSection("history");
            } else {
              setTaskFocus("interview");
            }
          }}
        >
          <span className="pb-bang" aria-hidden="true">
            {t("taskAlertBang")}
          </span>
          <span lang="ja">
            {alertApp
              ? t("taskAlertFeedback", { company: alertApp.company })
              : t("taskAlertNone")}
          </span>
        </button>
      </section>

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
        <div data-testid="kanban-row" className="pb-board pb-board-slot w-full">
          {visibleBoardColumns(visible).map((kind) => {
            const cards = visible.filter((app) => app.currentStageKind === kind);
            const vacant = cards.length === 0;
            return (
              <section
                key={kind}
                data-testid={`column-${kind}`}
                data-occupied={vacant ? "false" : "true"}
                className="pb-col flex min-w-0 flex-1 flex-col"
              >
                <header className="flex items-baseline justify-between px-1 py-2">
                  <h2 className="text-sm font-bold text-[var(--pb-ink-soft)]">
                    {t(columnKey(kind))}
                  </h2>
                  <span className="text-xs text-[var(--pb-muted)]">{cards.length}</span>
                </header>
                <div className="flex flex-col gap-2">
                  {cards.map((app) => {
                    const flags = appTaskFlags(app, nowMs);
                    const pulse = Boolean(taskFocus && flags[taskFocus]);
                    return (
                      <ApplicationCard
                        key={app.id}
                        app={app}
                        platformLabel={platformLabel(app.platformCode, app.platformName)}
                        t={t}
                        pulse={pulse}
                        menuOpen={menuAppId === app.id}
                        onToggleMenu={(event) => {
                          event.stopPropagation();
                          setMenuAppId((current) =>
                            current === app.id ? null : app.id,
                          );
                        }}
                        onEdit={() => {
                          setConflictMsg(null);
                          setMenuAppId(null);
                          setEditSection("basic");
                          setEditingApp(app);
                        }}
                        onPrep={() => {
                          setMenuAppId(null);
                          setPrepApp(app);
                        }}
                        onPass={() => {
                          setMenuAppId(null);
                          setPassConfirm(app);
                        }}
                        onReject={() => {
                          setMenuAppId(null);
                          void patchApp(app.id, { action: "reject" });
                        }}
                        onWithdraw={() => {
                          setMenuAppId(null);
                          void patchApp(app.id, { action: "withdraw" });
                        }}
                        onOffer={() => {
                          setMenuAppId(null);
                          void patchApp(app.id, { action: "offer" });
                        }}
                        onAccept={() => patchApp(app.id, { action: "accept_offer" })}
                        onDecline={() => patchApp(app.id, { action: "decline_offer" })}
                        onUndo={() => {
                          setMenuAppId(null);
                          void patchApp(app.id, { action: "undo" });
                        }}
                        onProposeSlots={() => openProposeSlots(app.id)}
                        onConfirmSlot={(slotId) => onConfirmSlot(app.id, slotId)}
                      />
                    );
                  })}
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
        </>
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
            className: "text-sm text-[var(--pb-red)]",
            testId: "delete-application",
          }}
        >
          <AddApplicationForm
            t={t}
            platforms={board.platforms}
            platformLabel={platformLabel}
            initial={editingApp}
            conflictMsg={conflictMsg}
            editSection={editSection}
            onEditSection={setEditSection}
            onSubmit={onEditApplication}
            onOpenFeedback={(interview, editing) =>
              openFeedback({
                appId: editingApp.id,
                company: editingApp.company,
                interview,
                editing: editing ?? null,
              })
            }
            onCancel={() => {
              setEditingApp(null);
              setConflictMsg(null);
              setEditSection("basic");
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
              editing={feedbackFor.editing ?? null}
              conflictMsg={conflictMsg}
              onSubmit={onSaveFeedback}
              onDelete={feedbackFor.editing ? onDeleteFeedback : undefined}
            />
          </div>
        </>
      ) : null}

      {passConfirm ? (
        <>
          <button
            type="button"
            className="pb-dialog-backdrop"
            aria-label={t("cancel")}
            onClick={() => setPassConfirm(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            data-testid="pass-confirm-dialog"
            className="pb-dialog"
          >
            <h3 className="m-0 text-base font-semibold text-[var(--pb-teal-deep)]">
              {t("passConfirmTitle")}
            </h3>
            <p className="mt-2 text-sm text-[var(--pb-ink-soft)]">
              {t("passConfirmBody")}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="pb-btn pb-btn-ghost pb-btn-sm"
                data-testid="pass-confirm-no"
                onClick={() => setPassConfirm(null)}
              >
                {t("passConfirmNo")}
              </button>
              <button
                type="button"
                className="pb-btn pb-btn-sm"
                data-testid="pass-confirm-yes"
                onClick={() => {
                  const id = passConfirm.id;
                  setPassConfirm(null);
                  void patchApp(id, { action: "pass" });
                }}
              >
                {t("passConfirmYes")}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {prepApp ? (
        <>
          <button
            type="button"
            className="pb-dialog-backdrop"
            aria-label={t("cancel")}
            onClick={() => setPrepApp(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            data-testid="interview-prep-dialog"
            className="pb-dialog"
          >
            <h3 className="m-0 text-base font-semibold text-[var(--pb-teal-deep)]">
              {t("interviewPrepTitle")}
            </h3>
            <p className="mt-2 text-sm text-[var(--pb-ink-soft)]">
              {t("interviewPrepBody")}
            </p>
            <div className="mt-3 rounded-xl bg-gradient-to-br from-[var(--pb-teal)] to-[var(--pb-teal-deep)] p-3 text-sm leading-relaxed text-[#eef7f4]">
              <div className="mb-1 text-[11px] font-bold opacity-75" lang="ja">
                {prepApp.company}
              </div>
              {t("interviewPrepPreview")}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="pb-btn pb-btn-ghost pb-btn-sm"
                onClick={() => setPrepApp(null)}
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </>
      ) : null}
      </div>
    </div>
  );
}

function AddApplicationForm({
  t,
  platforms,
  platformLabel,
  initial,
  conflictMsg,
  editSection = "basic",
  onEditSection,
  onSubmit,
  onCancel,
  onOpenFeedback,
}: {
  t: TBoard;
  platforms: BoardPayload["platforms"];
  platformLabel: (code: string | null, name: string | null) => string;
  initial?: BoardApplication;
  conflictMsg?: string | null;
  editSection?: EditSection;
  onEditSection?: (section: EditSection) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  onOpenFeedback?: (
    interview: BoardStageInterview,
    editing?: BoardFeedback | null,
  ) => void;
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
  const sections: { id: EditSection; label: string }[] = [
    { id: "basic", label: t("editSectionBasic") },
    { id: "company", label: t("editSectionCompany") },
    { id: "job", label: t("editSectionJob") },
    { id: "history", label: t("editSectionHistory") },
  ];
  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      {initial ? (
        <div className="pb-tabs" data-testid="edit-section-tabs">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              data-on={editSection === section.id ? "true" : "false"}
              data-testid={`edit-tab-${section.id}`}
              onClick={() => {
                onEditSection?.(section.id);
                document
                  .getElementById(`edit-sec-${section.id}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {section.label}
            </button>
          ))}
        </div>
      ) : null}
      <section id="edit-sec-basic" className="scroll-mt-2 space-y-3">
        {initial ? (
          <h3 className="border-b border-[var(--pb-line)] pb-1 text-sm font-bold text-[var(--pb-teal-deep)]">
            {t("editSectionBasic")}
          </h3>
        ) : null}
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
      </section>
      {initial ? (
        <>
          <section
            id="edit-sec-company"
            data-testid="company-section"
            className="scroll-mt-2 space-y-3 rounded-lg border border-[var(--pb-line)] bg-[var(--pb-card)] p-3"
          >
            <h3 className="text-sm font-bold text-[var(--pb-teal-deep)]">
              {t("companySection")}
            </h3>
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
            id="edit-sec-job"
            data-testid="job-posting-section"
            className="scroll-mt-2 space-y-3 rounded-lg border border-[var(--pb-line)] bg-[var(--pb-card)] p-3"
          >
            <h3 className="text-sm font-bold text-[var(--pb-teal-deep)]">
              {t("jobPostingSection")}
            </h3>
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
          <section
            id="edit-sec-history"
            data-testid="stage-interviews-section"
            className="scroll-mt-2 space-y-3 rounded-lg border border-[var(--pb-line)] bg-[var(--pb-card)] p-3"
          >
            <h3 className="text-sm font-bold text-[var(--pb-teal-deep)]">
              {t("editSectionHistory")}
            </h3>
            {initial.stageInterviews.length === 0 ? (
              <p className="text-sm text-zinc-500">{t("noStageInterviews")}</p>
            ) : (
              <StageInterviewFeedbackGroups
                t={t}
                interviews={initial.stageInterviews}
                onOpenFeedback={onOpenFeedback}
              />
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

function StageInterviewFeedbackGroups({
  t,
  interviews,
  onOpenFeedback,
}: {
  t: TBoard;
  interviews: BoardStageInterview[];
  onOpenFeedback?: (
    interview: BoardStageInterview,
    editing?: BoardFeedback | null,
  ) => void;
}) {
  const groups: { kind: string; items: BoardStageInterview[] }[] = [];
  for (const interview of interviews) {
    const last = groups[groups.length - 1];
    if (last && last.kind === interview.stageKind) {
      last.items.push(interview);
    } else {
      groups.push({ kind: interview.stageKind, items: [interview] });
    }
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <section
          key={group.kind}
          data-testid={`feedback-group-${group.kind}`}
          className="space-y-2"
        >
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {stageLabel(t, group.kind)}
          </h4>
          <ul className="space-y-2">
            {group.items.map((interview) => (
              <li
                key={interview.id}
                className="rounded border border-zinc-100 px-2 py-2 text-sm dark:border-zinc-800"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p lang="ja">
                    {`${formatTokyoShort(interview.start)} · ${interviewModeLabel(
                      interview.mode,
                    )}`}
                    {interview.status === "cancelled" ? ` · ${t("interviewCancelled")}` : ""}
                  </p>
                  {interview.canWriteFeedback ? (
                    <button
                      type="button"
                      data-testid={`append-feedback-${interview.id}`}
                      className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700"
                      onClick={() => onOpenFeedback?.(interview, null)}
                    >
                      {interview.feedbacks.length > 0
                        ? t("appendFeedback")
                        : t("writeFeedback")}
                    </button>
                  ) : interview.status === "scheduled" ? (
                    <span className="text-xs text-zinc-500">
                      {t("feedbackTooEarly")}
                    </span>
                  ) : null}
                </div>
                {interview.feedbacks.length > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {interview.feedbacks.map((feedback) => (
                      <li
                        key={feedback.id}
                        className="flex flex-wrap items-start justify-between gap-2 rounded bg-zinc-50 px-2 py-1.5 text-xs dark:bg-zinc-900"
                      >
                        <div lang="ja">
                          <p className="font-medium text-zinc-700 dark:text-zinc-200">
                            {feedback.summary}
                          </p>
                          <p className="text-zinc-500">{feedback.recordedOn}</p>
                        </div>
                        {interview.status !== "cancelled" ? (
                          <button
                            type="button"
                            className="rounded border border-zinc-300 px-2 py-0.5 dark:border-zinc-700"
                            onClick={() => onOpenFeedback?.(interview, feedback)}
                          >
                            {t("editFeedback")}
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-zinc-500">{t("noFeedbackYet")}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function FeedbackForm({
  t,
  interview,
  editing,
  conflictMsg,
  onSubmit,
  onDelete,
}: {
  t: TBoard;
  interview: BoardStageInterview;
  editing?: BoardFeedback | null;
  conflictMsg?: string | null;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
    qaItems: BoardFeedbackQaItem[],
  ) => void;
  onDelete?: () => void;
}) {
  const [qaItems, setQaItems] = useState<BoardFeedbackQaItem[]>(() => {
    if (editing?.qaItems?.length) return editing.qaItems;
    if (editing?.question || editing?.ownAnswer) {
      return [
        {
          question: editing.question,
          answer: editing.ownAnswer,
        },
      ];
    }
    return [{ question: "", answer: "", tag: "" }];
  });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => onSubmit(event, qaItems)}
      key={editing?.id ?? "new"}
    >
      <table className="w-full border-collapse text-sm">
        <tbody>
          <tr>
            <th className="w-[28%] border border-[var(--pb-line)] bg-[var(--pb-teal-soft)] px-2 py-2 text-left font-semibold text-[var(--pb-teal-deep)]">
              {t("feedbackMetaStage")}
            </th>
            <td className="border border-[var(--pb-line)] px-2 py-2" lang="ja">
              {stageLabel(t, interview.stageKind)}
            </td>
          </tr>
          <tr>
            <th className="border border-[var(--pb-line)] bg-[var(--pb-teal-soft)] px-2 py-2 text-left font-semibold text-[var(--pb-teal-deep)]">
              {t("feedbackMetaInterviewers")}
            </th>
            <td className="border border-[var(--pb-line)] px-2 py-2" lang="ja">
              {interview.interviewers?.trim() || t("dash")}
            </td>
          </tr>
          <tr>
            <th className="border border-[var(--pb-line)] bg-[var(--pb-teal-soft)] px-2 py-2 text-left font-semibold text-[var(--pb-teal-deep)]">
              {t("feedbackMetaWhen")}
            </th>
            <td className="border border-[var(--pb-line)] px-2 py-2">
              {formatTokyoShort(interview.start)}
            </td>
          </tr>
          <tr>
            <th className="border border-[var(--pb-line)] bg-[var(--pb-teal-soft)] px-2 py-2 text-left font-semibold text-[var(--pb-teal-deep)]">
              {t("feedbackMetaMode")}
            </th>
            <td className="border border-[var(--pb-line)] px-2 py-2">
              {interviewModeLabel(interview.mode)}
            </td>
          </tr>
          <tr>
            <th className="border border-[var(--pb-line)] bg-[var(--pb-teal-soft)] px-2 py-2 text-left font-semibold text-[var(--pb-teal-deep)]">
              {t("feedbackSource")}
            </th>
            <td className="border border-[var(--pb-line)] px-2 py-2">
              <select
                name="source"
                required
                defaultValue={editing?.source ?? "self"}
                className="w-full rounded border border-[var(--pb-line)] px-2 py-1.5"
              >
                <option value="company">{t("feedbackSourceCompany")}</option>
                <option value="recruiter">{t("feedbackSourceRecruiter")}</option>
                <option value="self">{t("feedbackSourceSelf")}</option>
              </select>
            </td>
          </tr>
          <tr>
            <th className="border border-[var(--pb-line)] bg-[var(--pb-teal-soft)] px-2 py-2 text-left font-semibold text-[var(--pb-teal-deep)]">
              {t("feedbackRecordedOn")}
            </th>
            <td className="border border-[var(--pb-line)] px-2 py-2">
              <input
                name="recordedOn"
                type="date"
                required
                defaultValue={editing?.recordedOn ?? tokyoTodayKey()}
                className="w-full rounded border border-[var(--pb-line)] px-2 py-1.5"
              />
            </td>
          </tr>
        </tbody>
      </table>

      <h3 className="m-0 text-sm font-bold text-[var(--pb-teal-deep)]">
        {t("feedbackQaHeading")}
      </h3>
      <div data-testid="feedback-qa-list">
        {qaItems.map((item, index) => (
          <div key={index} className="pb-qa" data-testid={`feedback-qa-${index}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <strong className="text-sm text-[var(--pb-teal-deep)]">
                {t("feedbackQaQuestionN", { n: String(index + 1).padStart(2, "0") })}
              </strong>
              {qaItems.length > 1 ? (
                <button
                  type="button"
                  className="text-xs text-[var(--pb-red)]"
                  onClick={() =>
                    setQaItems((rows) => rows.filter((_, i) => i !== index))
                  }
                >
                  {t("feedbackQaRemove")}
                </button>
              ) : null}
            </div>
            <label className="mb-2 flex flex-col gap-1 text-xs font-semibold text-[var(--pb-muted)]">
              {t("feedbackQaTag")}
              <input
                lang="ja"
                value={item.tag ?? ""}
                onChange={(event) =>
                  setQaItems((rows) =>
                    rows.map((row, i) =>
                      i === index ? { ...row, tag: event.target.value } : row,
                    ),
                  )
                }
                className="rounded border border-[var(--pb-line)] px-2 py-1.5 text-sm font-normal text-[var(--pb-ink)]"
              />
            </label>
            <label className="mb-2 flex flex-col gap-1 text-xs font-semibold text-[var(--pb-muted)]">
              {t("feedbackQuestion")}
              <textarea
                lang="ja"
                rows={2}
                value={item.question ?? ""}
                onChange={(event) =>
                  setQaItems((rows) =>
                    rows.map((row, i) =>
                      i === index ? { ...row, question: event.target.value } : row,
                    ),
                  )
                }
                className="rounded border border-[var(--pb-line)] px-2 py-1.5 text-sm font-normal text-[var(--pb-ink)]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--pb-muted)]">
              {t("feedbackOwnAnswer")}
              <textarea
                lang="ja"
                rows={2}
                value={item.answer ?? ""}
                onChange={(event) =>
                  setQaItems((rows) =>
                    rows.map((row, i) =>
                      i === index ? { ...row, answer: event.target.value } : row,
                    ),
                  )
                }
                className="rounded border border-[var(--pb-line)] px-2 py-1.5 text-sm font-normal text-[var(--pb-ink)]"
              />
            </label>
          </div>
        ))}
      </div>
      <button
        type="button"
        data-testid="feedback-qa-add"
        className="w-full rounded-full border border-dashed border-[#b9cfc7] bg-[var(--pb-teal-soft)] px-3 py-2 text-sm font-semibold text-[var(--pb-teal-deep)]"
        onClick={() =>
          setQaItems((rows) => [...rows, { question: "", answer: "", tag: "" }])
        }
      >
        {t("feedbackQaAdd")}
      </button>

      <label className="flex flex-col gap-1 text-sm">
        {t("feedbackBody")}
        <textarea
          name="body"
          lang="ja"
          rows={3}
          defaultValue={editing?.body ?? ""}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("feedbackResultText")}
        <input
          name="resultText"
          lang="ja"
          defaultValue={editing?.resultText ?? ""}
          placeholder={t("feedbackResultPlaceholder")}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("feedbackReflection")}
        <textarea
          name="reflection"
          lang="ja"
          rows={2}
          defaultValue={editing?.reflection ?? ""}
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
        <button type="submit" className="pb-btn pb-btn-sm">
          {editing ? t("feedbackSave") : t("feedbackAppend")}
        </button>
      </div>
    </form>
  );
}

function ApplicationCard({
  app,
  platformLabel,
  t,
  pulse,
  menuOpen,
  onToggleMenu,
  onEdit,
  onPrep,
  onPass,
  onReject,
  onWithdraw,
  onOffer,
  onAccept,
  onDecline,
  onUndo,
  onProposeSlots,
  onConfirmSlot,
}: {
  app: BoardApplication;
  platformLabel: string;
  t: TBoard;
  pulse: boolean;
  menuOpen: boolean;
  onToggleMenu: (event: MouseEvent) => void;
  onEdit: () => void;
  onPrep: () => void;
  onPass: () => void;
  onReject: () => void;
  onWithdraw: () => void;
  onOffer: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onUndo: () => void;
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
  const showUndo = canUndoAdvance({
    outcome: app.outcome,
    offerDecision: app.offerDecision,
    stages: app.stages,
  });
  const stageName = app.currentStageKind
    ? stageLabel(t, app.currentStageKind)
    : t("dash");

  return (
    <article
      data-testid={`card-${app.id}`}
      data-pulse={pulse ? "true" : "false"}
      data-conflict={app.conflict ? "true" : "false"}
      className="pb-card"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold leading-snug text-[var(--pb-teal-deep)]" lang="ja">
            {app.company}
          </p>
          {app.role ? (
            <p className="mt-0.5 text-[12.5px] text-[var(--pb-ink-soft)]" lang="ja">
              {app.role}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="rounded-full bg-[#e5f0f8] px-2 py-0.5 text-[11px] font-semibold text-[var(--pb-blue)]">
            {stageName}
          </span>
          <button
            type="button"
            data-testid={`card-menu-${app.id}`}
            aria-label={t("cardMore")}
            aria-expanded={menuOpen}
            className="px-1 text-lg leading-none text-[var(--pb-muted)]"
            onClick={onToggleMenu}
          >
            {t("cardMoreGlyph")}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div
          className="pb-menu"
          data-testid={`card-menu-panel-${app.id}`}
          onClick={(event) => event.stopPropagation()}
        >
          {inPlay && !offerPending && stageActions.includes("pass") ? (
            <button type="button" data-testid="action-pass" onClick={onPass}>
              {app.currentStageKind === "info_session"
                ? t("advanceNext")
                : t("menuPass")}
            </button>
          ) : null}
          {inPlay && !offerPending && stageActions.includes("reject") ? (
            <button
              type="button"
              data-testid="action-reject"
              data-danger="true"
              onClick={onReject}
            >
              {t("reject")}
            </button>
          ) : null}
          {inPlay && !offerPending && stageActions.includes("withdraw") ? (
            <button
              type="button"
              data-testid="action-withdraw"
              data-danger="true"
              onClick={onWithdraw}
            >
              {t("withdraw")}
            </button>
          ) : null}
          {inPlay && !offerPending && stageActions.includes("offer") ? (
            <button type="button" data-testid="action-offer" onClick={onOffer}>
              {t("markOffer")}
            </button>
          ) : null}
          {offerPending ? (
            <>
              <button type="button" onClick={onAccept}>
                {t("acceptOffer")}
              </button>
              <button type="button" data-danger="true" onClick={onDecline}>
                {t("declineOffer")}
              </button>
            </>
          ) : null}
          {showUndo ? (
            <button type="button" data-testid="action-undo" onClick={onUndo}>
              {t("undoStage")}
            </button>
          ) : null}
          <hr className="my-1 border-0 border-t border-[var(--pb-line)]" />
          <button
            type="button"
            data-testid={`edit-${app.id}`}
            onClick={onEdit}
          >
            {t("menuEdit")}
          </button>
          {inPlay && canSchedule && !interview ? (
            <button type="button" onClick={onProposeSlots}>
              {t("proposeSlots")}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2.5 flex flex-col gap-1.5 border-t border-dashed border-[var(--pb-line)] pt-2.5 text-[12.5px] text-[var(--pb-ink-soft)]">
        {interview ? (
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[11px] font-semibold text-[var(--pb-muted)]">
              {t("cardIconWhen")}
            </span>
            <span>{formatTokyoShort(interview.start)}</span>
            {interview.meetingUrl ? (
              <a
                href={interview.meetingUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded bg-[var(--pb-teal)] px-2 py-0.5 text-[11px] font-medium text-white"
              >
                {t("join")}
              </a>
            ) : null}
          </div>
        ) : !app.proposal ? (
          <div className="flex items-center gap-2 text-[var(--pb-muted)]">
            <span className="shrink-0 text-[11px] font-semibold">
              {t("cardIconWhen")}
            </span>
            <span>{t("unscheduled")}</span>
          </div>
        ) : null}
        {modeLabel ? (
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[11px] font-semibold text-[var(--pb-muted)]">
              {t("cardIconMode")}
            </span>
            <span>{modeLabel}</span>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-[11px] font-semibold text-[var(--pb-muted)]">
            {t("cardIconChannel")}
          </span>
          <span lang="ja">
            {app.recruiterName
              ? t("cardChannelWithRecruiter", {
                  platform: platformLabel,
                  recruiter: app.recruiterName,
                })
              : platformLabel}
          </span>
        </div>
        {app.proposal?.status === "sent" && !interview ? (
          <span className="rounded bg-[var(--pb-amber-bg)] px-1.5 py-0.5 text-[11px] text-[var(--pb-amber)]">
            {t("slotCount", { count: app.proposal.slots.length })}
          </span>
        ) : null}
        {app.conflict ? (
          <span className="font-medium text-[var(--pb-red)]">{t("conflict")}</span>
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

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {app.hasJobPosting ? (
          <span
            data-testid={`badge-job-${app.id}`}
            className="rounded-full bg-[var(--pb-teal-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--pb-green)]"
          >
            {t("badgeJobPosting")}
          </span>
        ) : (
          <span />
        )}
        {app.hasFeedback ? (
          <span
            data-testid={`badge-feedback-${app.id}`}
            className="rounded-full bg-[#e5f0f8] px-2 py-0.5 text-[11px] font-semibold text-[var(--pb-blue)]"
          >
            {t("badgeFeedback")}
          </span>
        ) : null}
        <span className="ml-auto text-[11.5px] text-[var(--pb-muted)]">
          {`${t("appliedOn")} ${app.appliedOn}`}
        </span>
      </div>

      <div className="mt-2 flex w-full gap-1.5">
        <button
          type="button"
          data-testid={`edit-${app.id}-detail`}
          className="pb-btn pb-btn-ghost pb-btn-sm flex-1"
          onClick={onEdit}
        >
          {t("cardDetail")}
        </button>
        <button
          type="button"
          data-testid={`prep-${app.id}`}
          className="pb-btn pb-btn-ink pb-btn-sm flex-[1.15]"
          onClick={onPrep}
        >
          {t("interviewPrep")}
        </button>
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
