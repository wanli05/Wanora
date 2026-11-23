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

export type OpenWithAssistInput = {
  target: AiTargetContext | null;
  draftText: string;
  feature: RefineFeature;
  fieldKey: RefineFieldKey;
  /** Bound record id when applicable; null for unsaved new rows; omit for profile fields. */
  recordId?: string | null;
  promptSeed?: string;
  /** True when Target could not be pinned (e.g. unsaved new row). */
  limitedContext?: boolean;
  /** Snapshot of draft at assist open / send time for conflict checks. */
  draftSnapshot: string;
  /** Must read the live draft (typically via a synced ref). */
  getCurrentDraft: () => string;
  /**
   * Apply refined text to the bound draft.
   * Must validate mount / record / field before mutating; return false if rejected.
   */
  onApplyToDraft: (refined: string) => boolean;
};

export type AiAssistBridgeError = "ai_unavailable" | null;

type AiAssistContextValue = {
  openWithAssist: (input: OpenWithAssistInput) => Promise<void>;
  /**
   * Open the shared AI sidebar panel only.
   * Does not change TargetContext, assist Apply binding, or composer draft.
   * Resolves true when the panel opener ran; false when AI is unavailable.
   */
  openPanel: () => Promise<boolean>;
  /** Clear Apply write-back rights; chat history may remain. */
  invalidateAssistApply: () => void;
  registerOpenHandler: (
    handler: (input: OpenWithAssistInput) => void,
  ) => () => void;
  registerPanelOpener: (handler: () => void) => () => void;
  registerInvalidateHandler: (handler: () => void) => () => void;
  bridgeError: AiAssistBridgeError;
  clearBridgeError: () => void;
};

const AiAssistContext = createContext<AiAssistContextValue | null>(null);

export function AiAssistProvider({ children }: { children: ReactNode }) {
  const handlerRef = useRef<((input: OpenWithAssistInput) => void) | null>(
    null,
  );
  const panelOpenerRef = useRef<(() => void) | null>(null);
  const invalidateHandlerRef = useRef<(() => void) | null>(null);
  const [bridgeError, setBridgeError] = useState<AiAssistBridgeError>(null);

  const clearBridgeError = useCallback(() => setBridgeError(null), []);

  const registerOpenHandler = useCallback(
    (handler: (input: OpenWithAssistInput) => void) => {
      handlerRef.current = handler;
      return () => {
        if (handlerRef.current === handler) handlerRef.current = null;
      };
    },
    [],
  );

  const registerPanelOpener = useCallback((handler: () => void) => {
    panelOpenerRef.current = handler;
    return () => {
      if (panelOpenerRef.current === handler) panelOpenerRef.current = null;
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
    handlerRef.current(input);
  }, []);

  const openPanel = useCallback(async () => {
    const status = await fetchAiStatus();
    if (!status.enabled || !panelOpenerRef.current) {
      setBridgeError("ai_unavailable");
      return false;
    }
    setBridgeError(null);
    panelOpenerRef.current();
    return true;
  }, []);

  const value = useMemo(
    () => ({
      openWithAssist,
      openPanel,
      invalidateAssistApply,
      registerOpenHandler,
      registerPanelOpener,
      registerInvalidateHandler,
      bridgeError,
      clearBridgeError,
    }),
    [
      openWithAssist,
      openPanel,
      invalidateAssistApply,
      registerOpenHandler,
      registerPanelOpener,
      registerInvalidateHandler,
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

/** Optional hook for pages that may render outside the provider in tests. */
export function useAiAssistOptional(): AiAssistContextValue | null {
  return useContext(AiAssistContext);
}
