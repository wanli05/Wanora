"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AiTargetContext } from "@/lib/ai/context/types";
import { fetchAiStatus } from "@/components/ai-sidebar/ai-api";
import type {
  RefineFeature,
  RefineFieldKey,
} from "@/components/ai-sidebar/refine-prompts";

export type AssistApplyMode = "single" | "multi";

export type OpenWithAssistInput = {
  target: AiTargetContext | null;
  /** Composer seed (single-field prompt or prebuilt module prompt). */
  draftText: string;
  feature: RefineFeature;
  fieldKey: RefineFieldKey;
  /** Bound record id when applicable; null for unsaved new rows; omit for profile fields. */
  recordId?: string | null;
  /**
   * Per-editor-instance draft key for unsaved employer/project rows.
   * Required when recordId is empty for narrative / project module drafts.
   */
  clientDraftKey?: string | null;
  promptSeed?: string;
  /** True when Target could not be pinned (e.g. unsaved new row). */
  limitedContext?: boolean;
  /** Snapshot of draft at assist open / send time for conflict checks. */
  draftSnapshot: string;
  /** Must read the live draft (typically via a synced ref). */
  getCurrentDraft: () => string;
  /**
   * Apply refined text to the bound draft (single-field / legacy).
   * Must validate mount / record / field before mutating; return false if rejected.
   */
  onApplyToDraft: (refined: string) => boolean;
  /** Default `single`. Module Profile/Project use `multi`. */
  applyMode?: AssistApplyMode;
  /** Whitelist for labeled 【修正案:id】 parsing when applyMode=multi. */
  allowedFieldIds?: readonly string[];
  /** Live multi-field drafts (multi only). */
  getCurrentDrafts?: () => Record<string, string>;
  /**
   * Apply a partial field map (multi only). Missing keys must not clear drafts.
   * Must validate mount / editor before mutating; return false if rejected.
   */
  onApplyFields?: (fields: Readonly<Record<string, string>>) => boolean;
};

export type AiAssistBridgeError = "ai_unavailable" | null;

export type OpenWithAssistHandler = (
  input: OpenWithAssistInput,
  meta: { openGeneration: number },
) => void | Promise<void>;

/** Rebuild single-field Apply when user opens a legacy slotted conversation. */
export type LegacySlotBinder = () => OpenWithAssistInput | null;

type AiAssistContextValue = {
  openWithAssist: (input: OpenWithAssistInput) => Promise<void>;
  /** Clear Apply write-back rights; chat history may remain. */
  invalidateAssistApply: () => void;
  registerOpenHandler: (handler: OpenWithAssistHandler) => () => void;
  registerInvalidateHandler: (handler: () => void) => () => void;
  /** Profile/project editors register binders keyed by exact assist_slot_key. */
  registerLegacySlotBinder: (
    assistSlotKey: string,
    binder: LegacySlotBinder,
  ) => () => void;
  resolveLegacySlotBinder: (assistSlotKey: string) => OpenWithAssistInput | null;
  bridgeError: AiAssistBridgeError;
  clearBridgeError: () => void;
};

const AiAssistContext = createContext<AiAssistContextValue | null>(null);

export function AiAssistProvider({ children }: { children: ReactNode }) {
  const handlerRef = useRef<OpenWithAssistHandler | null>(null);
  const invalidateHandlerRef = useRef<(() => void) | null>(null);
  const legacyBindersRef = useRef<Map<string, LegacySlotBinder>>(new Map());
  const openGenerationRef = useRef(0);
  const [bridgeError, setBridgeError] = useState<AiAssistBridgeError>(null);

  const clearBridgeError = useCallback(() => setBridgeError(null), []);

  const registerOpenHandler = useCallback((handler: OpenWithAssistHandler) => {
    handlerRef.current = handler;
    return () => {
      if (handlerRef.current === handler) handlerRef.current = null;
    };
  }, []);

  const registerInvalidateHandler = useCallback((handler: () => void) => {
    invalidateHandlerRef.current = handler;
    return () => {
      if (invalidateHandlerRef.current === handler) {
        invalidateHandlerRef.current = null;
      }
    };
  }, []);

  const registerLegacySlotBinder = useCallback(
    (assistSlotKey: string, binder: LegacySlotBinder) => {
      const key = assistSlotKey.trim().toLowerCase();
      legacyBindersRef.current.set(key, binder);
      return () => {
        if (legacyBindersRef.current.get(key) === binder) {
          legacyBindersRef.current.delete(key);
        }
      };
    },
    [],
  );

  const resolveLegacySlotBinder = useCallback((assistSlotKey: string) => {
    const key = assistSlotKey.trim().toLowerCase();
    return legacyBindersRef.current.get(key)?.() ?? null;
  }, []);

  const invalidateAssistApply = useCallback(() => {
    invalidateHandlerRef.current?.();
  }, []);

  const openWithAssist = useCallback(async (input: OpenWithAssistInput) => {
    const status = await fetchAiStatus();
    if (!status.enabled || !handlerRef.current) {
      setBridgeError("ai_unavailable");
      return;
    }
    setBridgeError(null);
    // latest-wins: each click bumps generation; stale async ensure must not apply.
    const openGeneration = ++openGenerationRef.current;
    await handlerRef.current(input, { openGeneration });
  }, []);

  const value = useMemo(
    () => ({
      openWithAssist,
      invalidateAssistApply,
      registerOpenHandler,
      registerInvalidateHandler,
      registerLegacySlotBinder,
      resolveLegacySlotBinder,
      bridgeError,
      clearBridgeError,
    }),
    [
      openWithAssist,
      invalidateAssistApply,
      registerOpenHandler,
      registerInvalidateHandler,
      registerLegacySlotBinder,
      resolveLegacySlotBinder,
      bridgeError,
      clearBridgeError,
    ],
  );

  return (
    <AiAssistContext.Provider value={value}>{children}</AiAssistContext.Provider>
  );
}

export function useAiAssist(): AiAssistContextValue {
  const ctx = useContext(AiAssistContext);
  if (!ctx) {
    throw new Error("useAiAssist must be used within AiAssistProvider");
  }
  return ctx;
}

export function useAiAssistOptional(): AiAssistContextValue | null {
  return useContext(AiAssistContext);
}
