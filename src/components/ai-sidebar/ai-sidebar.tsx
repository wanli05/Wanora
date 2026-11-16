"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { AiTargetContext } from "@/lib/ai/context/types";
import type { AiConversationDto, AiMessageDto } from "@/lib/ai/conversation";
import type { AiJobDto } from "@/lib/ai/jobs";
import {
  cancelJob,
  createConversation,
  deleteConversation,
  enqueueJob,
  listConversations,
  listMessages,
  patchConversation,
  readActiveConversationId,
  readPendingJob,
  writeActiveConversationId,
  writePendingJob,
  type PendingJobState,
} from "./ai-api";
import { jobStatusLabel, isJobTerminal } from "./job-status-label";
import { pageContextFromPath } from "./page-context";
import {
  ADJUSTABLE_TARGET_OPTIONS,
  suggestionsForPage,
  targetSelectValue,
} from "./suggestions";
import { useJobPolling } from "./use-job-polling";

export function AiSidebar() {
  const t = useTranslations("AiSidebar");
  const pathname = usePathname() ?? "/";
  const titleId = useId();
  const adjusterId = useId();
  const pageContext = pageContextFromPath(pathname);
  const [open, setOpen] = useState(false);
  /** Optional field focus; default null so chat can start without picking a Target. */
  const [targetContext, setTargetContext] = useState<AiTargetContext | null>(
    null,
  );
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [conversations, setConversations] = useState<AiConversationDto[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessageDto[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingJobState | null>(null);
  const [jobSnap, setJobSnap] = useState<AiJobDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const sendingRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  function formatTarget(tgt: AiTargetContext | null): string {
    if (!tgt) return t("targetNone");
    const opt = ADJUSTABLE_TARGET_OPTIONS.find(
      (o) => o.value === targetSelectValue(tgt),
    );
    return opt ? t(opt.labelKey) : tgt.type;
  }

  function pageLabel(): string {
    if (pageContext.area === "board") return t("pageBoard");
    if (pageContext.area === "my_career") return t("pageCareer");
    return t("pageOther");
  }

  function referenceLabel(): string {
    const page = pageLabel();
    if (!targetContext) return t("referencePage", { page });
    return t("referencePageTarget", {
      page,
      target: formatTarget(targetContext),
    });
  }

  const refreshMessages = useCallback(async (conversationId: string) => {
    const res = await listMessages(conversationId, { limit: 100 });
    if ("messages" in res && res.messages) {
      setMessages(res.messages);
    }
  }, []);

  const refreshConversations = useCallback(async () => {
    const res = await listConversations({ limit: 50, includeArchived: true });
    if ("unauthorized" in res && res.unauthorized) {
      setUnauthorized(true);
      return [];
    }
    if ("conversations" in res && res.conversations) {
      setConversations(res.conversations);
      setUnauthorized(false);
      return res.conversations;
    }
    return [];
  }, []);

  const selectConversation = useCallback(
    async (id: string, list?: AiConversationDto[]) => {
      setActiveId(id);
      writeActiveConversationId(id);
      setError(null);
      setAdjustOpen(false);
      if (list) {
        const conv = list.find((c) => c.id === id);
        // Preserve existing pinned Target in UI when present; do not invent one.
        setTargetContext(
          (conv?.pinnedTarget as AiTargetContext | null | undefined) ?? null,
        );
      }
      await refreshMessages(id);
    },
    [refreshMessages, setAdjustOpen],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const list = await refreshConversations();
      if (cancelled) return;
      const saved = readActiveConversationId();
      const pick =
        (saved &&
          list.find((c) => c.id === saved && c.status !== "deleted")?.id) ||
        list.find((c) => c.status === "active")?.id ||
        null;
      if (pick) {
        await selectConversation(pick, list);
      } else {
        setTargetContext(null);
      }
      const pendingJob = readPendingJob();
      if (pendingJob) {
        setPending(pendingJob);
        if (pendingJob.conversationId !== pick) {
          await selectConversation(pendingJob.conversationId, list);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, refreshConversations, selectConversation]);

  const onJobUpdate = useCallback((job: AiJobDto) => {
    setJobSnap(job);
  }, []);

  const onJobTerminal = useCallback(
    async (job: AiJobDto) => {
      setJobSnap(job);
      setPending(null);
      if (job.status === "succeeded" && job.conversationId) {
        await refreshMessages(job.conversationId);
      }
      setBusy(false);
      sendingRef.current = false;
    },
    [refreshMessages],
  );

  const onJobTimeout = useCallback(() => {
    setPending(null);
    setJobSnap(null);
    setBusy(false);
    sendingRef.current = false;
    setError(t("errJobTimeout"));
  }, [t]);

  useJobPolling(pending, onJobUpdate, onJobTerminal, onJobTimeout);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, jobSnap, open]);

  async function ensureConversation(): Promise<string | null> {
    if (activeId) return activeId;
    const created = await createConversation({
      title: null,
      pinnedTarget: targetContext,
    });
    if ("error" in created) {
      setError(t("errCreateConversation"));
      return null;
    }
    const id = created.conversation.id;
    const list = await refreshConversations();
    await selectConversation(id, list);
    return id;
  }

  async function onSend() {
    const content = draft.trim();
    if (!content || sendingRef.current || busy) return;
    sendingRef.current = true;
    setBusy(true);
    setError(null);
    setAdjustOpen(false);

    const conversationId = await ensureConversation();
    if (!conversationId) {
      sendingRef.current = false;
      setBusy(false);
      return;
    }

    const clientRequestId = crypto.randomUUID();
    const optimistic: AiMessageDto = {
      id: `local-${clientRequestId}`,
      conversationId,
      role: "user",
      content,
      pageContext,
      targetContext,
      clientMessageId: clientRequestId,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setDraft("");

    const res = await enqueueJob({
      conversationId,
      clientRequestId,
      content,
      pageContext,
      targetContext,
    });

    if ("error" in res && res.error) {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setDraft(content);
      const code = res.error.error;
      if (code === "budget_exceeded") setError(t("errBudget"));
      else if (code === "rate_limited") setError(t("errRate"));
      else if (code === "ai_unavailable") setError(t("errUnavailable"));
      else setError(res.error.message ?? t("errSend"));
      sendingRef.current = false;
      setBusy(false);
      return;
    }

    if (!("job" in res) || !res.job) {
      sendingRef.current = false;
      setBusy(false);
      return;
    }

    const state: PendingJobState = {
      jobId: res.job.id,
      conversationId,
      clientRequestId,
    };
    writePendingJob(state);
    setPending(state);
    setJobSnap(res.job);
    await refreshMessages(conversationId);

    if (isJobTerminal(res.job.status)) {
      writePendingJob(null);
      setPending(null);
      setBusy(false);
      sendingRef.current = false;
    }
  }

  async function onCancelJob() {
    if (!pending) return;
    const res = await cancelJob(pending.jobId);
    if ("job" in res && res.job) {
      setJobSnap(res.job);
      if (isJobTerminal(res.job.status)) {
        writePendingJob(null);
        setPending(null);
        setBusy(false);
        sendingRef.current = false;
        await refreshMessages(res.job.conversationId);
      }
    }
  }

  async function onNewConversation() {
    setTargetContext(null);
    setAdjustOpen(false);
    const created = await createConversation({
      pinnedTarget: null,
    });
    if ("conversation" in created) {
      const list = await refreshConversations();
      await selectConversation(created.conversation.id, list);
      setMessages([]);
      setJobSnap(null);
    }
  }

  async function onArchive() {
    if (!activeId) return;
    await patchConversation(activeId, { status: "archived" });
    await refreshConversations();
  }

  async function onDelete() {
    if (!activeId) return;
    if (!window.confirm(t("deleteConfirm"))) return;
    await deleteConversation(activeId);
    writeActiveConversationId(null);
    setActiveId(null);
    setMessages([]);
    setTargetContext(null);
    const list = await refreshConversations();
    const next = list.find((c) => c.status === "active");
    if (next) await selectConversation(next.id, list);
  }

  function onTargetAdjust(value: string) {
    const opt = ADJUSTABLE_TARGET_OPTIONS.find((o) => o.value === value);
    setTargetContext(opt?.target ?? null);
  }

  function applySuggestion(chip: ReturnType<typeof suggestionsForPage>[number]) {
    setDraft(t(chip.promptKey));
    setTargetContext(chip.target);
    setAdjustOpen(false);
  }

  const showSuggestions = messages.length === 0 && !busy && !pending;
  const chips = suggestionsForPage(pageContext);

  if (unauthorized) return null;

  return (
    <>
      <button
        type="button"
        className="ai-sidebar-toggle"
        data-testid="ai-sidebar-toggle"
        aria-expanded={open}
        aria-controls="ai-sidebar-panel"
        onClick={() => setOpen((v) => !v)}
      >
        {t("toggle")}
      </button>

      {open ? (
        <div
          className="ai-sidebar-backdrop"
          data-testid="ai-sidebar-backdrop"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      ) : null}

      <aside
        id="ai-sidebar-panel"
        className="ai-sidebar-panel"
        data-testid="ai-sidebar-panel"
        data-open={open ? "true" : "false"}
        aria-hidden={!open}
        aria-labelledby={titleId}
      >
        <header className="ai-sidebar-header">
          <h2 id={titleId} className="ai-sidebar-title">
            {t("title")}
          </h2>
          <p className="ai-sidebar-note">{t("readonlyNote")}</p>
          <button
            type="button"
            className="ai-sidebar-close"
            data-testid="ai-sidebar-close"
            onClick={() => setOpen(false)}
          >
            {t("close")}
          </button>
        </header>

        <div className="ai-sidebar-conv-bar">
          <select
            data-testid="ai-conversation-select"
            value={activeId ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              if (id) void selectConversation(id, conversations);
            }}
          >
            <option value="" disabled>
              {t("selectConversation")}
            </option>
            {conversations
              .filter((c) => c.status !== "deleted")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.status === "archived" ? t("archivedPrefix") : ""}
                  {c.title?.trim() || t("untitled")}
                </option>
              ))}
          </select>
          <button
            type="button"
            data-testid="ai-new-conversation"
            onClick={() => void onNewConversation()}
          >
            {t("new")}
          </button>
          <button
            type="button"
            data-testid="ai-archive-conversation"
            onClick={() => void onArchive()}
            disabled={!activeId}
          >
            {t("archive")}
          </button>
          <button
            type="button"
            data-testid="ai-delete-conversation"
            onClick={() => void onDelete()}
            disabled={!activeId}
          >
            {t("delete")}
          </button>
        </div>

        <div
          className="ai-sidebar-messages"
          ref={listRef}
          data-testid="ai-sidebar-messages"
        >
          {showSuggestions ? (
            <div
              className="ai-sidebar-suggestions"
              data-testid="ai-suggestions"
            >
              <p className="ai-sidebar-empty">{t("emptyMessages")}</p>
              <p className="ai-sidebar-suggest-lead">{t("suggestLead")}</p>
              <div className="ai-sidebar-suggest-list">
                {chips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    className="ai-sidebar-suggest-chip"
                    data-testid={`ai-suggest-${chip.id}`}
                    disabled={busy}
                    onClick={() => applySuggestion(chip)}
                  >
                    {t(chip.labelKey)}
                  </button>
                ))}
              </div>
            </div>
          ) : messages.length === 0 ? (
            <p className="ai-sidebar-empty">{t("emptyMessages")}</p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className="ai-sidebar-msg"
                data-role={m.role}
                data-testid={`ai-msg-${m.role}`}
              >
                <span className="ai-sidebar-msg-role">
                  {m.role === "user"
                    ? t("roleYou")
                    : m.role === "assistant"
                      ? t("roleAi")
                      : m.role}
                </span>
                <p>{m.content}</p>
              </div>
            ))
          )}
          {jobSnap && !isJobTerminal(jobSnap.status) ? (
            <div className="ai-sidebar-job" data-testid="ai-job-status">
              {jobStatusLabel(jobSnap, t)}
              <button
                type="button"
                data-testid="ai-job-cancel"
                onClick={() => void onCancelJob()}
              >
                {t("cancelJob")}
              </button>
            </div>
          ) : null}
          {jobSnap &&
          isJobTerminal(jobSnap.status) &&
          jobSnap.status !== "succeeded" ? (
            <div
              className="ai-sidebar-job ai-sidebar-job-done"
              data-testid="ai-job-terminal"
            >
              {jobStatusLabel(jobSnap, t)}
            </div>
          ) : null}
        </div>

        {error ? (
          <p
            className="ai-sidebar-error"
            data-testid="ai-sidebar-error"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="ai-sidebar-composer-wrap">
          <div className="ai-sidebar-ref-row">
            <button
              type="button"
              className="ai-sidebar-ref"
              data-testid="ai-context-ref"
              aria-expanded={adjustOpen}
              aria-controls={adjusterId}
              onClick={() => setAdjustOpen((v) => !v)}
            >
              {referenceLabel()}
            </button>
            <span className="ai-sidebar-ref-hint" data-testid="ai-page-context">
              {pageContext.area ?? "other"}
            </span>
          </div>

          {adjustOpen ? (
            <div
              id={adjusterId}
              className="ai-sidebar-adjust"
              data-testid="ai-context-adjuster"
            >
              <p className="ai-sidebar-adjust-lead">{t("adjustLead")}</p>
              <label className="ai-sidebar-adjust-field">
                <span>{t("adjustFocus")}</span>
                <select
                  data-testid="ai-target-select"
                  value={targetSelectValue(targetContext)}
                  onChange={(e) => onTargetAdjust(e.target.value)}
                >
                  {ADJUSTABLE_TARGET_OPTIONS.map((o) => (
                    <option key={o.value || "none"} value={o.value}>
                      {t(o.labelKey)}
                    </option>
                  ))}
                </select>
              </label>
              <p
                className="ai-sidebar-target-view"
                data-testid="ai-target-context"
              >
                {t("targetCurrent", { label: formatTarget(targetContext) })}
              </p>
            </div>
          ) : null}

          <form
            className="ai-sidebar-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void onSend();
            }}
          >
            <textarea
              data-testid="ai-composer-input"
              rows={3}
              value={draft}
              placeholder={t("placeholder")}
              disabled={busy}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void onSend();
                }
              }}
            />
            <button
              type="submit"
              data-testid="ai-composer-send"
              disabled={busy || !draft.trim()}
            >
              {busy ? t("sending") : t("send")}
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
