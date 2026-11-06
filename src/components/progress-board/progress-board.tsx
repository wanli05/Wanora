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
import type { BoardApplication, BoardPayload } from "@/lib/progress/dto";
import {
  allowedAdvanceActions,
  isClosed,
  visibleBoardColumns,
} from "@/lib/progress/stages";
import { defaultFreeSlots, type DraftSlot } from "@/lib/progress/slots";
import {
  formatTokyoShort,
  fromTokyoInputValue,
  toTokyoInputValue,
  tokyoNowParts,
} from "@/lib/progress/tokyo";
import { MonthCalendar } from "./month-calendar";
import { SlotGrid } from "./slot-grid";

type View = "kanban" | "list";
type Filter = "in_progress" | "closed" | "all";
type TBoard = ReturnType<typeof useTranslations<"Board">>;

function columnKey(kind: (typeof BOARD_COLUMN_KINDS)[number]) {
  return `col_${kind}` as const;
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
  const [scheduleKind, setScheduleKind] = useState<"confirm" | "propose">("confirm");
  const [draftSlots, setDraftSlots] = useState<DraftSlot[]>([]);
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [nowMs] = useState(() => Date.now());
  const nowParts = tokyoNowParts(new Date(nowMs));
  const [calYear, setCalYear] = useState(nowParts.year);
  const [calMonth, setCalMonth] = useState(nowParts.month);

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
        setCalendarOpen(false);
        setInterviewFor(null);
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
  const schedulingApp = interviewFor
    ? apps.find((app) => app.id === interviewFor)
    : undefined;
  const schedulingInterview = schedulingApp?.interview;
  const monthCount = board.occupancy.filter((item) => {
    if (item.kind !== "confirmed") return false;
    const key = item.start;
    return key.includes(
      `${calYear}-${String(calMonth).padStart(2, "0")}`,
    );
  }).length;

  async function refreshFrom(payload: BoardPayload) {
    setBoard(payload);
  }

  async function onAddApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const company = String(form.get("company")).trim();
    if (!company) return;
    const platformId = String(form.get("platformId"));
    const recruiterName = String(form.get("recruiterName") || "").trim() || null;
    try {
      const payload = await readJson(
        await fetch("/api/board/applications", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            company,
            role: String(form.get("role") || "").trim() || undefined,
            platformId,
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
    const platformId = String(form.get("platformId"));
    const recruiterName = String(form.get("recruiterName") || "").trim() || null;
    try {
      const payload = await readJson(
        await fetch(`/api/board/applications/${editingApp.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            company,
            role: String(form.get("role") || "").trim() || null,
            platformId,
            recruiterName,
            notes: String(form.get("notes") || "").trim() || null,
            appliedOn: String(form.get("appliedOn") || "") || undefined,
          }),
        }),
      );
      const start = String(form.get("start") || "");
      const end = String(form.get("end") || "");
      const url = String(form.get("url") || "").trim();
      const mode = String(form.get("mode") || "");
      if (start && end && mode) {
        const afterInterview = await readJson(
          await fetch(`/api/board/applications/${editingApp.id}/interviews`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              interviewId: editingApp.interview?.id,
              start: fromTokyoInputValue(start),
              end: fromTokyoInputValue(end),
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

  async function onAddInterview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!interviewFor) return;
    const form = new FormData(event.currentTarget);
    const start = fromTokyoInputValue(String(form.get("start")));
    const end = fromTokyoInputValue(String(form.get("end")));
    const existing = apps.find((app) => app.id === interviewFor)?.interview;
    try {
      const payload = await readJson(
        await fetch(`/api/board/applications/${interviewFor}/interviews`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            interviewId: existing?.id,
            start,
            end,
            mode: String(form.get("mode")),
            meetingUrl: String(form.get("url") || "").trim() || undefined,
          }),
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
          ? `${t("conflictBlock")} ${t("conflictWith", {
              company: details.otherCompany,
              when: formatTokyoShort(details.otherStart),
            })}`
          : t("conflictBlock"),
      );
    }
  }

  function openSchedule(appId: string, kind: "confirm" | "propose") {
    setConflictMsg(null);
    setScheduleKind(kind);
    setInterviewFor(appId);
    if (kind === "propose") {
      const existing = apps.find((app) => app.id === appId)?.proposal?.slots ?? [];
      setDraftSlots(
        existing.length > 0
          ? existing.map((slot) => ({ start: slot.start, end: slot.end }))
          : defaultFreeSlots(board.occupancy, appId),
      );
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
            onClick={() => setCalendarOpen((open) => !open)}
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
                      onSkip={() => patchApp(app.id, { action: "skip" })}
                      onReject={() => patchApp(app.id, { action: "reject" })}
                      onWithdraw={() => patchApp(app.id, { action: "withdraw" })}
                      onOffer={() => patchApp(app.id, { action: "offer" })}
                      onAccept={() => patchApp(app.id, { action: "accept_offer" })}
                      onDecline={() => patchApp(app.id, { action: "decline_offer" })}
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
          closeLabel={t("cancel")}
          onClose={() => {
            setEditingApp(null);
            setConflictMsg(null);
          }}
        >
          <AddApplicationForm
            t={t}
            platforms={board.platforms}
            platformLabel={platformLabel}
            initial={editingApp}
            conflictMsg={conflictMsg}
            onSubmit={onEditApplication}
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

      {interviewFor && scheduleKind === "propose" ? (
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

      {interviewFor && scheduleKind === "confirm" ? (
        <Modal
          title={schedulingInterview ? t("editInterview") : t("addInterview")}
          closeLabel={t("cancel")}
          onClose={() => {
            setInterviewFor(null);
            setConflictMsg(null);
          }}
        >
          <form className="flex flex-col gap-3" onSubmit={onAddInterview}>
            <label className="flex flex-col gap-1 text-sm">
              {t("mode")}
              <select
                name="mode"
                defaultValue={schedulingInterview?.mode ?? "google_meet"}
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
              defaultValue={schedulingInterview?.meetingUrl ?? ""}
            />
            <Field
              name="start"
              label={t("start")}
              type="datetime-local"
              required
              defaultValue={toTokyoInputValue(
                schedulingInterview?.start ?? new Date(nowMs).toISOString(),
              )}
            />
            <Field
              name="end"
              label={t("end")}
              type="datetime-local"
              required
              defaultValue={toTokyoInputValue(
                schedulingInterview?.end ??
                  new Date(nowMs + 60 * 60 * 1000).toISOString(),
              )}
            />
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
                {t("saveInterview")}
              </button>
            </div>
          </form>
        </Modal>
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
}: {
  t: TBoard;
  platforms: BoardPayload["platforms"];
  platformLabel: (code: string | null, name: string | null) => string;
  initial?: BoardApplication;
  conflictMsg?: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const [platformId, setPlatformId] = useState(
    initial?.platformId ?? platforms[0]?.id ?? "",
  );
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
        <label className="flex flex-col gap-1 text-sm">
          {t("notes")}
          <textarea
            name="notes"
            lang="ja"
            defaultValue={initial.notes ?? ""}
            rows={3}
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
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
          <Field
            name="end"
            label={t("end")}
            type="datetime-local"
            defaultValue={
              initial?.interview ? toTokyoInputValue(initial.interview.end) : ""
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

function ApplicationCard({
  app,
  platformLabel,
  t,
  onEdit,
  onPass,
  onSkip,
  onReject,
  onWithdraw,
  onOffer,
  onAccept,
  onDecline,
  onAddInterview,
  onProposeSlots,
  onConfirmSlot,
}: {
  app: BoardApplication;
  platformLabel: string;
  t: TBoard;
  onEdit: () => void;
  onPass: () => void;
  onSkip: () => void;
  onReject: () => void;
  onWithdraw: () => void;
  onOffer: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onAddInterview: () => void;
  onProposeSlots: () => void;
  onConfirmSlot: (slotId: string) => void;
}) {
  const interview = app.interview;
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
      <p className="mt-2 text-sm" lang="ja">
        {app.nextPrep}
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
              {stageActions.includes("skip") ? (
                <button
                  type="button"
                  data-testid="action-skip"
                  className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700"
                  onClick={onSkip}
                >
                  {t("skip")}
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
        {inPlay && canSchedule ? (
          <>
            {!interview ? (
              <button
                type="button"
                className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700"
                onClick={onProposeSlots}
              >
                {t("proposeSlots")}
              </button>
            ) : null}
            <button
              type="button"
              data-testid="action-interview"
              className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700"
              onClick={onAddInterview}
            >
              {interview ? t("editInterview") : t("addInterview")}
            </button>
          </>
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
  children,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl dark:bg-zinc-950"
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
