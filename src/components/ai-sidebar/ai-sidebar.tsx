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
import { useJobPolling } from "./use-job-polling";

export function AiSidebar() {
  const t = useTranslations("AiSidebar");
  const pathname = usePathname() ?? "/";
  const titleId = useId();
  const pageContext = pageContextFromPath(pathname);
  const [open, setOpen] = useState(false);
  const [targetContext, setTargetContext] = useState<AiTargetContext | null>(
    null,
  );
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

  const targetOptions: {
    value: string;
    label: string;
    target: AiTargetContext | null;
  }[] = [
    { value: "", label: t("targetNone"), target: null },
    {
      value: "profile:self_pr",
      label: t("targetSelfPr"),
      target: { type: "profile", section: "self_pr" },
    },
    {
      value: "profile:job_summary",
      label: t("targetJobSummary"),
      target: { type: "profile", section: "job_summary" },
    },
    {
      value: "profile:headline",
      label: t("targetHeadline"),
      target: { type: "profile", section: "headline" },
    },
    {
      value: "profile:overview",
      label: t("targetOverview"),
      target: { type: "profile", section: "overview" },
    },
  ];

  function targetSelectValue(tgt: AiTargetContext | null): string {
    if (!tgt) return "";
    if (tgt.type === "profile") return `profile:${tgt.section ?? "overview"}`;
    return "";
  }

  function formatTarget(tgt: AiTargetContext | null): string {
    if (!tgt) return t("targetNone");
    const opt = targetOptions.find((o) => o.value === targetSelectValue(tgt));
    return opt?.label ?? tgt.type;
  }

  function pageLabel(): string {
    if (pageContext.area === "board") return t("pageBoard");
    if (pageContext.area === "my_career") return t("pageCareer");
    return pageContext.path;
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
    async (id: string) => {
      setActiveId(id);
      writeActiveConversationId(id);
      setError(null);
      await refreshMessages(id);
    },
    [refreshMessages],
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
        await selectConversation(pick);
      }
      const pendingJob = readPendingJob();
      if (pendingJob) {
        setPending(pendingJob);
        if (pendingJob.conversationId !== pick) {
          await selectConversation(pendingJob.conversationId);
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

  useJobPolling(pending, onJobUpdate, onJobTerminal);

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
    await refreshConversations();
    await selectConversation(id);
    return id;
  }

  async function onSend() {
    const content = draft.trim();
    if (!content || sendingRef.current || busy) return;
    sendingRef.current = true;
    setBusy(true);
    setError(null);

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
    const created = await createConversation({
      pinnedTarget: targetContext,
    });
    if ("conversation" in created) {
      await refreshConversations();
      await selectConversation(created.conversation.id);
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
    const list = await refreshConversations();
    const next = list.find((c) => c.status === "active");
    if (next) await selectConversation(next.id);
  }

  function onTargetChange(value: string) {
    const opt = targetOptions.find((o) => o.value === value);
    setTargetContext(opt?.target ?? null);
  }

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

        <div className="ai-sidebar-context" data-testid="ai-sidebar-context">
          <div>
            <span className="ai-sidebar-k">{t("page")}</span>
            <span data-testid="ai-page-context">
              {pageLabel()}
              {pageContext.area ? `（${pageContext.area}）` : ""}
            </span>
          </div>
          <label className="ai-sidebar-target">
            <span className="ai-sidebar-k">{t("target")}</span>
            <select
              data-testid="ai-target-select"
              value={targetSelectValue(targetContext)}
              onChange={(e) => onTargetChange(e.target.value)}
            >
              {targetOptions.map((o) => (
                <option key={o.value || "none"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div
            className="ai-sidebar-target-view"
            data-testid="ai-target-context"
          >
            {t("targetCurrent", { label: formatTarget(targetContext) })}
          </div>
        </div>

        <div className="ai-sidebar-conv-bar">
          <select
            data-testid="ai-conversation-select"
            value={activeId ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              if (id) void selectConversation(id);
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
          {messages.length === 0 ? (
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
      </aside>
    </>
  );
}
