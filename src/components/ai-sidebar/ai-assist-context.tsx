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
  promptSeed?: string;
  /** True when Target could not be pinned (e.g. unsaved new row). */
  limitedContext?: boolean;
  /** Snapshot of draft at assist open / send time for conflict checks. */
  draftSnapshot: string;
  getCurrentDraft: () => string;
  onApplyToDraft: (refined: string) => void;
};

export type AiAssistBridgeError = "ai_unavailable" | null;

type AiAssistContextValue = {
  openWithAssist: (input: OpenWithAssistInput) => Promise<void>;
  registerOpenHandler: (
    handler: (input: OpenWithAssistInput) => void,
  ) => () => void;
  bridgeError: AiAssistBridgeError;
  clearBridgeError: () => void;
};

const AiAssistContext = createContext<AiAssistContextValue | null>(null);

export function AiAssistProvider({ children }: { children: ReactNode }) {
  const handlerRef = useRef<((input: OpenWithAssistInput) => void) | null>(
    null,
  );
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

  const openWithAssist = useCallback(async (input: OpenWithAssistInput) => {
    const status = await fetchAiStatus();
    if (!status.enabled || !handlerRef.current) {
      setBridgeError("ai_unavailable");
      return;
    }
    setBridgeError(null);
    handlerRef.current(input);
  }, []);

  const value = useMemo(
    () => ({
      openWithAssist,
      registerOpenHandler,
      bridgeError,
      clearBridgeError,
    }),
    [openWithAssist, registerOpenHandler, bridgeError, clearBridgeError],
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
