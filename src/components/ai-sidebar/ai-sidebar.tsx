"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  formatConversationDate,
  historySourceKeyFromSlot,
} from "@/components/ai-sidebar/conversation-history-meta";
import type { AiTargetContext } from "@/lib/ai/context/types";
import type { AiConversationDto, AiMessageDto } from "@/lib/ai/conversation";
import type { AiJobDto } from "@/lib/ai/jobs";
import { useAiAssist } from "@/components/ai-sidebar/ai-assist-context";
import { formatMultiApplyFieldList } from "@/components/ai-sidebar/apply-confirm";
import { assistContextLabelKeys } from "@/components/ai-sidebar/assist-context-labels";
import {
  type ComposerSizeMode,
  composerMaxHeightPx,
  composerShowsCollapseControl,
  heightFromDrag,
  resolveComposerHeightPx,
} from "@/components/ai-sidebar/composer-height";
import {
  Maximize2Icon,
  Minimize2Icon,
} from "@/components/ai-sidebar/composer-icons";
import {
  extractRefinedFields,
  extractRefinedText,
} from "@/components/ai-sidebar/extract-refined-text";
import {
  assistSlotKeyForRefineField,
  buildRefinePrompt,
  defaultAssistTitle,
  type RefineFeature,
  type RefineFieldKey,
} from "@/components/ai-sidebar/refine-prompts";
import type { AssistApplyMode } from "@/components/ai-sidebar/ai-assist-context";
import {
  cancelJob,
  createConversation,
  deleteConversation,
  enqueueJob,
  ensureAssistConversation,
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
import { suggestionsForPage } from "./suggestions";
import { useJobPolling } from "./use-job-polling";

type AssistSession = {
  requestId: string;
  fieldKey: RefineFieldKey;
  feature: RefineFeature;
  target: AiTargetContext | null;
  recordId: string | null;
  assistSlotKey: string;
  draftSnapshot: string;
  getCurrentDraft: () => string;
  /** Returns false when binding is stale / unmounted. */
  onApplyToDraft: (refined: string) => boolean;
  applyMode: AssistApplyMode;
  allowedFieldIds: readonly string[];
  getCurrentDrafts?: () => Record<string, string>;
  onApplyFields?: (fields: Readonly<Record<string, string>>) => boolean;
  limitedContext?: boolean;
  clientRequestId?: string;
  applyMessageId?: string | null;
  /** When true, chat may remain but form write-back is disabled. */
  applyRevoked?: boolean;
};

function ConversationRowMenu({
  archiveLabel,
  deleteLabel,
  menuLabel,
  disabled,
  onArchive,
  onDelete,
}: {
  archiveLabel: string;
  deleteLabel: string;
  menuLabel: string;
  disabled?: boolean;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: globalThis.PointerEvent) => {
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
    <div className="ai-hist-menu" ref={rootRef}>
      <button
        type="button"
        className="ai-hist-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={menuLabel}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {"\u2026"}
      </button>
      {open ? (
        <div className="ai-hist-menu-panel" role="menu">
          <button
            type="button"
            role="menuitem"
            data-testid="ai-archive-conversation"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onArchive();
            }}
          >
            {archiveLabel}
          </button>
          <button
            type="button"
            role="menuitem"
            className="ai-hist-menu-danger"
            data-testid="ai-delete-conversation"
            onClick={(e) => {
              e.stopPropagation();
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

export function AiSidebar() {
  const t = useTranslations("AiSidebar");
  const locale = useLocale();
  const pathname = usePathname() ?? "/";
  const titleId = useId();
  const pageContext = pageContextFromPath(pathname);
  const [panelView, setPanelView] = useState<"chat" | "history">("chat");
  const {
    registerOpenHandler,
    registerInvalidateHandler,
    resolveLegacySlotBinder,
  } = useAiAssist();
  const [open, setOpen] = useState(false);
  /** Optional send Target from suggestions / conversation pin — not user-picked via UI. */
  const [targetContext, setTargetContext] = useState<AiTargetContext | null>(
    null,
  );
  /** Pure UI height mode; never persisted to conversation/DB. */
  const [composerSizeMode, setComposerSizeMode] =
    useState<ComposerSizeMode>("default");
  const [composerManualHeightPx, setComposerManualHeightPx] = useState<
    number | null
  >(null);
  const [composerViewport, setComposerViewport] = useState({
    width: 1280,
    height: 800,
  });
  const [composerPanelHeightPx, setComposerPanelHeightPx] = useState(700);
  const composerSelectionRef = useRef<{ start: number; end: number } | null>(
    null,
  );
  const composerDragRef = useRef<{
    pointerId: number;
    startY: number;
    startHeight: number;
  } | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const [conversations, setConversations] = useState<AiConversationDto[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessageDto[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingJobState | null>(null);
  const [jobSnap, setJobSnap] = useState<AiJobDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [assistSession, setAssistSession] = useState<AssistSession | null>(
    null,
  );
  const [applyNotice, setApplyNotice] = useState<string | null>(null);
  const [assistOpening, setAssistOpening] = useState(false);
  /** When assist is open, list defaults to the current slot unless user opts in. */
  const [showAllConversations, setShowAllConversations] = useState(false);
  const sendingRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const composerHeightPx = resolveComposerHeightPx({
    mode: composerSizeMode,
    manualHeightPx: composerManualHeightPx,
    viewportWidthPx: composerViewport.width,
    viewportHeightPx: composerViewport.height,
    panelHeightPx: composerPanelHeightPx,
  });
  const composerCollapse = composerShowsCollapseControl(composerSizeMode);
  /** When set (including null), open/select must not clobber Target with conversation pin. */
  const assistTargetLockRef = useRef<AiTargetContext | null | undefined>(
    undefined,
  );
  /** Tracks latest openWithAssist generation for stale-async discard. */
  const openGenerationRef = useRef(0);
  const assistSlotKeyRef = useRef<string | null>(null);
  /**
   * Invalidates in-flight Q7 general restore when the user creates a thread or
   * opens Assist — otherwise a late selectConversation clears send errors (QA-25).
   */
  const generalRestoreGenRef = useRef(0);
  const conversationsRef = useRef(conversations);
  const selectConversationRef = useRef<
    (id: string, list?: AiConversationDto[]) => Promise<void>
  >(async () => {});
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  function pageLabel(): string {
    if (pageContext.area === "board") return t("pageBoard");
    if (pageContext.area === "my_career") return t("pageCareer");
    return t("pageOther");
  }

  function referenceLabel(): string {
    return t("referencePage", { page: pageLabel() });
  }

  const refreshMessages = useCallback(async (conversationId: string) => {
    const res = await listMessages(conversationId, { limit: 100 });
    if ("messages" in res && res.messages) {
      setMessages(res.messages);
    }
  }, []);

  const refreshConversations = useCallback(
    async (opts?: { assistSlotKey?: string | null; showAll?: boolean }) => {
      const slot = opts?.assistSlotKey ?? assistSlotKeyRef.current;
      const showAll = opts?.showAll ?? showAllConversations;
      const res =
        slot && !showAll
          ? await listConversations({
              limit: 50,
              includeArchived: true,
              assistSlotKey: slot,
            })
          : await listConversations({ limit: 50, includeArchived: true });
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
    },
    [showAllConversations],
  );

  const clearAssistSendContext = useCallback(() => {
    assistTargetLockRef.current = undefined;
    assistSlotKeyRef.current = null;
    setAssistSession(null);
    setApplyNotice(null);
    setTargetContext(null);
  }, []);

  const selectConversation = useCallback(
    async (id: string, list?: AiConversationDto[]) => {
      setActiveId(id);
      writeActiveConversationId(id);
      setError(null);
      const conv = (list ?? conversationsRef.current).find((c) => c.id === id);
      const lockedSlot = assistSlotKeyRef.current;
      const convSlot = conv?.assistSlotKey ?? null;
      // Only clear when we *know* the selected row is another slot / legacy.
      // Missing list rows (race / empty refresh) must not drop AssistSession.
      const leavingAssistSlot =
        lockedSlot != null &&
        conv != null &&
        (convSlot == null || convSlot !== lockedSlot);

      const armLegacyBinder = (slot: string): boolean => {
        const legacy = resolveLegacySlotBinder(slot);
        if (!legacy) return false;
        assistTargetLockRef.current = legacy.target;
        assistSlotKeyRef.current = slot;
        setTargetContext(legacy.target);
        setAssistSession({
          requestId: crypto.randomUUID(),
          fieldKey: legacy.fieldKey,
          feature: legacy.feature,
          target: legacy.target,
          recordId: legacy.recordId ?? null,
          assistSlotKey: slot,
          draftSnapshot: legacy.draftSnapshot,
          getCurrentDraft: legacy.getCurrentDraft,
          onApplyToDraft: legacy.onApplyToDraft,
          applyMode: legacy.applyMode ?? "single",
          allowedFieldIds: legacy.allowedFieldIds ?? [],
          getCurrentDrafts: legacy.getCurrentDrafts,
          onApplyFields: legacy.onApplyFields,
          limitedContext: legacy.limitedContext,
          applyMessageId: null,
          applyRevoked: false,
        });
        return true;
      };

      if (leavingAssistSlot) {
        // Switching to another slot or legacy: drop Apply + wrong Target/send ctx.
        clearAssistSendContext();
        setTargetContext(
          (conv?.pinnedTarget as AiTargetContext | null | undefined) ?? null,
        );
        // Rebuild Apply for legacy / module slots when editor registered a binder.
        if (convSlot) armLegacyBinder(convSlot);
      } else if (lockedSlot == null && convSlot) {
        // History select without an active assist lock — arm binder if editor open.
        if (!armLegacyBinder(convSlot)) {
          setTargetContext(
            (conv?.pinnedTarget as AiTargetContext | null | undefined) ?? null,
          );
        }
      } else {
        // Same assist slot: keep session, clear prior Apply message id.
        setAssistSession((prev) =>
          prev
            ? { ...prev, applyMessageId: null, clientRequestId: undefined }
            : null,
        );
        if (assistTargetLockRef.current !== undefined) {
          setTargetContext(assistTargetLockRef.current);
        } else {
          setTargetContext(
            (conv?.pinnedTarget as AiTargetContext | null | undefined) ?? null,
          );
        }
      }
      await refreshMessages(id);
    },
    [refreshMessages, clearAssistSendContext, resolveLegacySlotBinder],
  );
  useEffect(() => {
    selectConversationRef.current = selectConversation;
  }, [selectConversation]);

  useEffect(() => {
    if (!open) return;
    // Assist open path selects its own conversation; skip general restore race.
    if (assistTargetLockRef.current !== undefined) return;
    const gen = ++generalRestoreGenRef.current;
    let cancelled = false;
    (async () => {
      // Q7: general open only restores unslotted (legacy/general) conversations.
      const res = await listConversations({
        limit: 50,
        includeArchived: true,
        unslotted: true,
      });
      if (cancelled || gen !== generalRestoreGenRef.current) return;
      if (assistTargetLockRef.current !== undefined) return;
      if ("unauthorized" in res && res.unauthorized) {
        setUnauthorized(true);
        return;
      }
      const list =
        "conversations" in res && res.conversations ? res.conversations : [];
      setConversations(list);
      const saved = readActiveConversationId();
      const savedOk =
        saved &&
        list.find(
          (c) =>
            c.id === saved &&
            c.status !== "deleted" &&
            c.assistSlotKey == null,
        )?.id;
      const pick =
        savedOk || list.find((c) => c.status === "active")?.id || null;
      if (cancelled || gen !== generalRestoreGenRef.current) return;
      if (assistTargetLockRef.current !== undefined) return;
      if (pick) {
        await selectConversationRef.current(pick, list);
      } else {
        setTargetContext(null);
        setActiveId(null);
      }
      if (cancelled || gen !== generalRestoreGenRef.current) return;
      const pendingJob = readPendingJob();
      if (pendingJob) {
        // Resume pending only if it belongs to an unslotted / already-listed row.
        const pendingConv = list.find((c) => c.id === pendingJob.conversationId);
        if (pendingConv && pendingConv.assistSlotKey == null) {
          setPending(pendingJob);
          if (pendingJob.conversationId !== pick) {
            await selectConversationRef.current(pendingJob.conversationId, list);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const onJobUpdate = useCallback((job: AiJobDto) => {
    setJobSnap(job);
  }, []);

  const onJobTerminal = useCallback(
    async (job: AiJobDto) => {
      setJobSnap(job);
      setPending(null);
      if (job.status === "succeeded" && job.conversationId) {
        const res = await listMessages(job.conversationId, { limit: 100 });
        if ("messages" in res && res.messages) {
          setMessages(res.messages);
          setAssistSession((prev) => {
            if (!prev?.clientRequestId) return prev;
            const userIdx = res.messages.findIndex(
              (m) =>
                m.role === "user" &&
                m.clientMessageId === prev.clientRequestId,
            );
            if (userIdx < 0) return prev;
            const assistant = res.messages
              .slice(userIdx + 1)
              .find((m) => m.role === "assistant");
            if (!assistant) return prev;
            return { ...prev, applyMessageId: assistant.id };
          });
        }
      }
      setBusy(false);
      sendingRef.current = false;
    },
    [],
  );

  const revokeAssistApply = useCallback(() => {
    assistTargetLockRef.current = undefined;
    setAssistSession((prev) =>
      prev
        ? {
            ...prev,
            applyMessageId: null,
            applyRevoked: true,
            getCurrentDraft: () => "",
            onApplyToDraft: () => false,
            onApplyFields: () => false,
            getCurrentDrafts: () => ({}),
          }
        : null,
    );
    setApplyNotice(null);
  }, []);

  useEffect(() => {
    return registerInvalidateHandler(revokeAssistApply);
  }, [registerInvalidateHandler, revokeAssistApply]);

  // Leaving My Career must drop form write-back; conversation messages may stay.
  const prevPathRef = useRef(pathname);
  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = pathname;
    const wasCareer = pageContextFromPath(prev).area === "my_career";
    const isCareer = pageContextFromPath(pathname).area === "my_career";
    if (wasCareer && !isCareer) {
      revokeAssistApply();
    }
  }, [pathname, revokeAssistApply]);

  useEffect(() => {
    return registerOpenHandler(async (input, meta) => {
      openGenerationRef.current = meta.openGeneration;
      const slotKey = assistSlotKeyForRefineField(
        input.fieldKey,
        input.recordId ?? null,
        input.clientDraftKey ?? null,
      );
      if (!slotKey) {
        setError(t("errCreateConversation"));
        return;
      }

      const requestId = crypto.randomUUID();
      // Drop any in-flight Q7 restore so it cannot clear Assist / send errors.
      generalRestoreGenRef.current += 1;
      assistTargetLockRef.current = input.target;
      assistSlotKeyRef.current = slotKey;
      setShowAllConversations(false);
      setPanelView("chat");
      setOpen(true);
      setError(null);
      setApplyNotice(null);
      setAssistOpening(true);
      // Always rebind Target for this assist request — never keep a stale pin.
      setTargetContext(input.target);
      const applyMode: AssistApplyMode = input.applyMode ?? "single";
      setDraft(
        applyMode === "multi"
          ? input.draftText
          : buildRefinePrompt({
              feature: input.feature,
              draftText: input.draftText,
              promptSeed: input.promptSeed,
              limitedContext: input.limitedContext,
            }),
      );
      setAssistSession({
        requestId,
        fieldKey: input.fieldKey,
        feature: input.feature,
        target: input.target,
        recordId: input.recordId ?? null,
        assistSlotKey: slotKey,
        draftSnapshot: input.draftSnapshot,
        getCurrentDraft: input.getCurrentDraft,
        onApplyToDraft: input.onApplyToDraft,
        applyMode,
        allowedFieldIds: input.allowedFieldIds ?? [],
        getCurrentDrafts: input.getCurrentDrafts,
        onApplyFields: input.onApplyFields,
        limitedContext: input.limitedContext,
        applyMessageId: null,
        applyRevoked: false,
      });

      try {
        const ensured = await ensureAssistConversation({
          assistSlotKey: slotKey,
          pinnedTarget: input.target,
          title: defaultAssistTitle(input.fieldKey),
        });
        if (meta.openGeneration !== openGenerationRef.current) {
          // Stale open — a newer field click won.
          return;
        }
        if ("error" in ensured) {
          setError(t("errCreateConversation"));
          return;
        }
        const list = await refreshConversations({
          assistSlotKey: slotKey,
          showAll: false,
        });
        if (meta.openGeneration !== openGenerationRef.current) return;
        await selectConversation(ensured.conversation.id, list);
        if (meta.openGeneration !== openGenerationRef.current) return;
        // Composer stays as latest draft prompt; do not clear/overwrite messages.
        queueMicrotask(() => composerRef.current?.focus());
      } finally {
        if (meta.openGeneration === openGenerationRef.current) {
          setAssistOpening(false);
        }
      }
    });
  }, [registerOpenHandler, refreshConversations, selectConversation, t]);

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
    const slot = assistSession?.assistSlotKey ?? null;
    const created = await createConversation({
      title: slot ? defaultAssistTitle(assistSession!.fieldKey) : null,
      pinnedTarget: assistSession?.target ?? targetContext,
      assistSlotKey: slot,
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

    const conversationId = await ensureConversation();
    if (!conversationId) {
      sendingRef.current = false;
      setBusy(false);
      return;
    }

    const clientRequestId = crypto.randomUUID();
    const sendTarget = assistSession?.target ?? targetContext;
    const sendFeature = assistSession?.feature;
    // Keep draftSnapshot from assist-open time so form edits after open
    // still trigger overwrite confirm (do not re-baseline on send).
    setAssistSession((prev) =>
      prev
        ? {
            ...prev,
            clientRequestId,
            applyMessageId: null,
          }
        : null,
    );
    const optimistic: AiMessageDto = {
      id: `local-${clientRequestId}`,
      conversationId,
      role: "user",
      content,
      pageContext,
      targetContext: sendTarget,
      clientMessageId: clientRequestId,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setDraft("");

    let res: Awaited<ReturnType<typeof enqueueJob>>;
    try {
      res = await enqueueJob({
        conversationId,
        clientRequestId,
        content,
        pageContext,
        targetContext: sendTarget,
        feature: sendFeature,
      });
    } catch {
      // Network abort / fetch throw — not an HTTP { error } body (QA-25).
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setDraft(content);
      setError(t("errSend"));
      sendingRef.current = false;
      setBusy(false);
      return;
    }

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
      if (res.job.status === "succeeded") {
        await onJobTerminal(res.job);
      } else {
        setBusy(false);
        sendingRef.current = false;
      }
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
    const slot = assistSession?.assistSlotKey ?? null;
    const pinned = assistSession?.target ?? null;
    const fieldKey = assistSession?.fieldKey;
    // Invalidate Q7 restore so a late pick cannot wipe this thread / send error.
    generalRestoreGenRef.current += 1;
    // Keep AssistSession when creating a new thread in the same refine slot.
    if (!slot) {
      clearAssistSendContext();
    } else {
      setAssistSession((prev) =>
        prev
          ? {
              ...prev,
              applyMessageId: null,
              clientRequestId: undefined,
              applyRevoked: false,
            }
          : null,
      );
      setApplyNotice(null);
      if (assistSession) {
        setDraft(
          buildRefinePrompt({
            feature: assistSession.feature,
            draftText: assistSession.getCurrentDraft(),
            limitedContext: assistSession.limitedContext,
          }),
        );
      }
    }
    const created = await createConversation({
      title: fieldKey ? defaultAssistTitle(fieldKey) : null,
      pinnedTarget: pinned,
      assistSlotKey: slot,
    });
    if ("conversation" in created) {
      const list = await refreshConversations({
        assistSlotKey: slot,
        showAll: showAllConversations,
      });
      await selectConversation(created.conversation.id, list);
      setMessages([]);
      setJobSnap(null);
    }
  }

  async function onArchive(conversationId?: string) {
    const id = conversationId ?? activeId;
    if (!id) return;
    await patchConversation(id, { status: "archived" });
    await refreshConversations({
      assistSlotKey: assistSession?.assistSlotKey ?? null,
      showAll: panelView === "history" ? true : showAllConversations,
    });
  }

  async function onDelete(conversationId?: string) {
    const id = conversationId ?? activeId;
    if (!id) return;
    if (!window.confirm(t("deleteConfirm"))) return;
    await deleteConversation(id);
    if (id === activeId) {
      writeActiveConversationId(null);
      setActiveId(null);
      setMessages([]);
      setTargetContext(null);
    }
    const list = await refreshConversations({
      assistSlotKey: assistSession?.assistSlotKey ?? null,
      showAll: panelView === "history" ? true : showAllConversations,
    });
    if (id === activeId) {
      const next = list.find((c) => c.status === "active");
      if (next) await selectConversation(next.id, list);
    }
  }

  async function openHistoryView() {
    setPanelView("history");
    setShowAllConversations(true);
    await refreshConversations({
      assistSlotKey: assistSession?.assistSlotKey ?? null,
      showAll: true,
    });
  }

  async function pickHistoryConversation(id: string) {
    setPanelView("chat");
    await selectConversation(id, conversations);
  }

  function applySuggestion(chip: ReturnType<typeof suggestionsForPage>[number]) {
    clearAssistSendContext();
    setDraft(t(chip.promptKey));
    setTargetContext(chip.target);
  }

  function applyAssistantToDraft(message: AiMessageDto) {
    if (
      !assistSession ||
      assistSession.applyRevoked ||
      assistSession.applyMessageId !== message.id
    ) {
      return;
    }

    if (assistSession.applyMode === "multi") {
      const fields = extractRefinedFields(
        message.content,
        assistSession.allowedFieldIds,
      );
      if (fields && assistSession.onApplyFields) {
        // One confirm only: list fields that will be written + overwrite warning.
        const fieldList = formatMultiApplyFieldList(Object.keys(fields));
        const proceed = window.confirm(
          t("applyFieldsConfirm", { fields: fieldList }),
        );
        if (!proceed) return;
        const applied = assistSession.onApplyFields(fields);
        if (!applied) {
          setApplyNotice(t("applyRejectedStale"));
          revokeAssistApply();
          return;
        }
        setApplyNotice(t("applyDraftOnly"));
        return;
      }
      // Legacy unlabeled bubble in a module thread → overview / single binder only.
      const legacySingle = extractRefinedText(message.content);
      if (!legacySingle) {
        setApplyNotice(t("applyExtractFailed"));
        return;
      }
      const current = assistSession.getCurrentDraft();
      if (current !== assistSession.draftSnapshot) {
        const ok = window.confirm(t("applyOverwriteConfirm"));
        if (!ok) return;
      }
      const applied = assistSession.onApplyToDraft(legacySingle);
      if (!applied) {
        setApplyNotice(t("applyRejectedStale"));
        revokeAssistApply();
        return;
      }
      setApplyNotice(t("applyDraftOnly"));
      return;
    }

    const refined = extractRefinedText(message.content);
    if (!refined) {
      setApplyNotice(t("applyExtractFailed"));
      return;
    }
    // Conflict check against the live draft (ref-backed), not click-time state.
    const current = assistSession.getCurrentDraft();
    if (current !== assistSession.draftSnapshot) {
      const ok = window.confirm(t("applyOverwriteConfirm"));
      if (!ok) return;
    }
    const applied = assistSession.onApplyToDraft(refined);
    if (!applied) {
      setApplyNotice(t("applyRejectedStale"));
      revokeAssistApply();
      return;
    }
    setApplyNotice(t("applyDraftOnly"));
  }

  const showSuggestions =
    messages.length === 0 && !busy && !pending && !assistSession;
  const chips = suggestionsForPage(pageContext);

  function resetComposerSize() {
    setComposerSizeMode("default");
    setComposerManualHeightPx(null);
  }

  function closePanel() {
    // Allow next general toggle-open to use unslotted restore (Q7).
    assistTargetLockRef.current = undefined;
    resetComposerSize();
    setOpen(false);
  }

  function rememberComposerSelection() {
    const el = composerRef.current;
    if (!el) return;
    composerSelectionRef.current = {
      start: el.selectionStart,
      end: el.selectionEnd,
    };
  }

  function toggleComposerExpanded() {
    rememberComposerSelection();
    if (composerShowsCollapseControl(composerSizeMode)) {
      resetComposerSize();
      return;
    }
    setComposerManualHeightPx(null);
    setComposerSizeMode("expanded");
  }

  function onComposerResizePointerDown(
    e: ReactPointerEvent<HTMLDivElement>,
  ) {
    // Desktop drag only — avoid fighting mobile page scroll.
    if (composerViewport.width <= 640) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    const panel = panelRef.current;
    if (panel) {
      setComposerPanelHeightPx(panel.getBoundingClientRect().height);
    }
    const handle = e.currentTarget;
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      /* jsdom / unsupported */
    }
    composerDragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startHeight: composerHeightPx,
    };
    document.body.style.userSelect = "none";
  }

  function onComposerResizePointerMove(
    e: ReactPointerEvent<HTMLDivElement>,
  ) {
    const drag = composerDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const max = composerMaxHeightPx(
      composerPanelHeightPx,
      composerViewport.height,
    );
    const clamped = heightFromDrag(
      drag.startHeight,
      drag.startY,
      e.clientY,
      max,
    );
    setComposerSizeMode("manual");
    setComposerManualHeightPx(clamped);
  }

  function endComposerResize(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = composerDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    composerDragRef.current = null;
    document.body.style.userSelect = "";
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }

  useLayoutEffect(() => {
    const el = composerRef.current;
    const sel = composerSelectionRef.current;
    if (!el || !sel) return;
    try {
      el.setSelectionRange(sel.start, sel.end);
      el.focus();
    } catch {
      /* ignore selection restore failures */
    }
    composerSelectionRef.current = null;
  }, [composerSizeMode, composerHeightPx]);

  useEffect(() => {
    function syncViewport() {
      setComposerViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
      const panel = panelRef.current;
      if (panel) {
        setComposerPanelHeightPx(panel.getBoundingClientRect().height);
      }
    }
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, [open]);

  useEffect(() => {
    return () => {
      document.body.style.userSelect = "";
      composerDragRef.current = null;
    };
  }, []);

  function openViaToggle() {
    if (open) {
      closePanel();
      return;
    }
    // General entry must not resume a My Career refine slot (Q7).
    assistTargetLockRef.current = undefined;
    assistSlotKeyRef.current = null;
    setAssistSession(null);
    setApplyNotice(null);
    setShowAllConversations(false);
    setOpen(true);
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
        onClick={openViaToggle}
      >
        {t("toggle")}
      </button>

      {open ? (
        <div
          className="ai-sidebar-backdrop"
          data-testid="ai-sidebar-backdrop"
          onClick={closePanel}
          aria-hidden
        />
      ) : null}

      <aside
        ref={panelRef}
        id="ai-sidebar-panel"
        className="ai-sidebar-panel"
        data-testid="ai-sidebar-panel"
        data-open={open ? "true" : "false"}
        data-active-conversation-id={activeId ?? ""}
        data-assist-slot-key={assistSession?.assistSlotKey ?? ""}
        data-assist-opening={assistOpening ? "true" : "false"}
        aria-hidden={!open}
        aria-labelledby={titleId}
      >
        <header className="ai-sidebar-header">
          <h2 id={titleId} className="ai-sidebar-title">
            {t("title")}
          </h2>
          <p className="ai-sidebar-note">{t("readonlyNote")}</p>
          {assistSession?.limitedContext ? (
            <p
              className="ai-sidebar-note"
              data-testid="ai-assist-limited-context"
            >
              {t("limitedContextNote")}
            </p>
          ) : null}
          <button
            type="button"
            className="ai-sidebar-close"
            data-testid="ai-sidebar-close"
            onClick={closePanel}
          >
            {t("close")}
          </button>
        </header>
        {assistOpening ? (
          <p
            className="ai-sidebar-note"
            data-testid="ai-assist-opening"
          >
            {t("assistOpening")}
          </p>
        ) : null}

        <div className="ai-sidebar-view-tabs" role="tablist" aria-label={t("title")}>
          <button
            type="button"
            role="tab"
            className="ai-sidebar-view-tab"
            data-testid="ai-view-chat"
            aria-selected={panelView === "chat"}
            data-active={panelView === "chat" ? "true" : "false"}
            onClick={() => setPanelView("chat")}
          >
            {t("viewChat")}
          </button>
          <button
            type="button"
            role="tab"
            className="ai-sidebar-view-tab"
            data-testid="ai-view-history"
            aria-selected={panelView === "history"}
            data-active={panelView === "history" ? "true" : "false"}
            onClick={() => void openHistoryView()}
          >
            {t("viewHistory")}
          </button>
        </div>

        {panelView === "history" ? (
          <div
            className="ai-sidebar-history"
            data-testid="ai-conversation-history"
          >
            {conversations.filter((c) => c.status !== "deleted").length ===
            0 ? (
              <p className="ai-sidebar-empty">{t("historyEmpty")}</p>
            ) : (
              <ul className="ai-hist-list">
                {conversations
                  .filter((c) => c.status !== "deleted")
                  .map((c) => {
                    const sourceKey = historySourceKeyFromSlot(c.assistSlotKey);
                    const source =
                      sourceKey != null ? t(sourceKey) : null;
                    const date = formatConversationDate(c.updatedAt, locale);
                    const title =
                      (c.status === "archived" ? t("archivedPrefix") : "") +
                      (c.title?.trim() || t("untitled"));
                    return (
                      <li key={c.id}>
                        <div
                          className="ai-hist-row"
                          data-active={c.id === activeId ? "true" : "false"}
                        >
                          <button
                            type="button"
                            className="ai-hist-main"
                            data-testid="ai-history-item"
                            data-conversation-id={c.id}
                            onClick={() => void pickHistoryConversation(c.id)}
                          >
                            <span className="ai-hist-title">{title}</span>
                            <span className="ai-hist-meta">
                              {[source, date].filter(Boolean).join(" · ")}
                            </span>
                          </button>
                          <ConversationRowMenu
                            menuLabel={t("conversationMenu")}
                            archiveLabel={t("archive")}
                            deleteLabel={t("delete")}
                            onArchive={() => void onArchive(c.id)}
                            onDelete={() => void onDelete(c.id)}
                          />
                        </div>
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        ) : null}

        {panelView === "chat" && !assistSession ? (
          <div className="ai-sidebar-conv-bar">
            <button
              type="button"
              data-testid="ai-new-conversation"
              onClick={() => void onNewConversation()}
            >
              {t("newChat")}
            </button>
          </div>
        ) : null}
        {/* Assist refine keeps a hidden new-chat control for existing e2e flows. */}
        {panelView === "chat" && assistSession ? (
          <button
            type="button"
            className="sr-only"
            data-testid="ai-new-conversation"
            tabIndex={-1}
            onClick={() => void onNewConversation()}
          >
            {t("newChat")}
          </button>
        ) : null}

        {panelView === "chat" ? (
          <>
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
            messages.map((m) => {
              const applyArmed =
                !!assistSession &&
                !assistSession.applyRevoked &&
                assistSession.applyMessageId === m.id;
              const multiOk =
                !!assistSession &&
                assistSession.applyMode === "multi" &&
                extractRefinedFields(
                  m.content,
                  assistSession.allowedFieldIds,
                ) != null;
              const singleOk = extractRefinedText(m.content) != null;
              const parseOk =
                !!assistSession &&
                (assistSession.applyMode === "multi"
                  ? multiOk || singleOk
                  : singleOk);
              const canApply =
                m.role === "assistant" && applyArmed && parseOk;
              const copyOnly =
                m.role === "assistant" && applyArmed && !parseOk;
              return (
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
                  {canApply ? (
                    <button
                      type="button"
                      className="ai-sidebar-suggest-chip"
                      data-testid="ai-apply-to-draft"
                      onClick={() => applyAssistantToDraft(m)}
                    >
                      {t("applyToDraft")}
                    </button>
                  ) : null}
                  {copyOnly ? (
                    <p
                      className="ai-sidebar-ref-hint"
                      data-testid="ai-apply-copy-only"
                    >
                      {t("applyExtractFailed")}
                    </p>
                  ) : null}
                </div>
              );
            })
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
        {applyNotice ? (
          <p
            className="ai-sidebar-note"
            data-testid="ai-apply-notice"
            role="status"
          >
            {applyNotice}
          </p>
        ) : null}

        <div className="ai-sidebar-composer-wrap" data-testid="ai-composer-wrap">
          {assistSession ? (
            <div
              className="ai-sidebar-assist-context"
              data-testid="ai-assist-context"
            >
              {(() => {
                const keys = assistContextLabelKeys(assistSession.fieldKey);
                return (
                  <>
                    <p
                      className="ai-sidebar-assist-ref"
                      data-testid="ai-assist-ref"
                    >
                      {t(keys.referenceKey)}
                    </p>
                    <p
                      className="ai-sidebar-assist-scope"
                      data-testid="ai-assist-scope"
                    >
                      {t(keys.scopeKey)}
                    </p>
                  </>
                );
              })()}
              <span className="ai-sidebar-ref-hint" data-testid="ai-page-context">
                {pageContext.area ?? "other"}
              </span>
            </div>
          ) : (
            <div className="ai-sidebar-ref-row">
              <span
                className="ai-sidebar-ref"
                data-testid="ai-context-ref"
              >
                {referenceLabel()}
              </span>
              <span
                className="ai-sidebar-ref-hint"
                data-testid="ai-page-context"
              >
                {pageContext.area ?? "other"}
              </span>
            </div>
          )}

          <form
            className="ai-sidebar-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void onSend();
            }}
          >
            <div className="ai-sidebar-composer-toolbar">
              <button
                type="button"
                className="ai-sidebar-composer-expand"
                data-testid="ai-composer-expand"
                data-size-mode={composerSizeMode}
                aria-pressed={composerCollapse}
                aria-label={
                  composerCollapse
                    ? t("composerCollapseAria")
                    : t("composerExpandAria")
                }
                title={
                  composerCollapse ? t("composerCollapse") : t("composerExpand")
                }
                onClick={toggleComposerExpanded}
              >
                {composerCollapse ? (
                  <Minimize2Icon className="ai-sidebar-composer-expand-icon" />
                ) : (
                  <Maximize2Icon className="ai-sidebar-composer-expand-icon" />
                )}
              </button>
            </div>
            <div
              className="ai-sidebar-composer-resize"
              data-testid="ai-composer-resize-handle"
              role="separator"
              aria-orientation="horizontal"
              aria-label={t("composerResizeAria")}
              aria-valuenow={composerHeightPx}
              aria-valuemin={100}
              aria-valuemax={composerMaxHeightPx(
                composerPanelHeightPx,
                composerViewport.height,
              )}
              onPointerDown={onComposerResizePointerDown}
              onPointerMove={onComposerResizePointerMove}
              onPointerUp={endComposerResize}
              onPointerCancel={endComposerResize}
            >
              <span className="ai-sidebar-composer-resize-grip" aria-hidden />
            </div>
            <textarea
              ref={composerRef}
              className="ai-sidebar-composer-input"
              data-testid="ai-composer-input"
              data-expanded={composerCollapse ? "true" : "false"}
              data-size-mode={composerSizeMode}
              rows={6}
              style={{ height: composerHeightPx }}
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
          </>
        ) : null}
      </aside>
    </>
  );
}
