"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  getNavCollapsedServerSnapshot,
  getNavCollapsedSnapshot,
  setNavCollapsedSnapshot,
  subscribeNavCollapsed,
} from "@/lib/nav-chrome-storage";

type NavChromeContextValue = {
  /** Desktop collapsed rail (icon-only). */
  collapsed: boolean;
  setCollapsed: (next: boolean) => void;
  toggleCollapsed: () => void;
  /** Mobile drawer open. */
  mobileOpen: boolean;
  setMobileOpen: (next: boolean) => void;
  toggleMobileOpen: () => void;
};

const NavChromeContext = createContext<NavChromeContextValue | null>(null);

export function NavChromeProvider({ children }: { children: ReactNode }) {
  const collapsed = useSyncExternalStore(
    subscribeNavCollapsed,
    getNavCollapsedSnapshot,
    getNavCollapsedServerSnapshot,
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  const setCollapsed = useCallback((next: boolean) => {
    setNavCollapsedSnapshot(next);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setNavCollapsedSnapshot(!getNavCollapsedSnapshot());
  }, []);

  const toggleMobileOpen = useCallback(() => {
    setMobileOpen((v) => !v);
  }, []);

  const value = useMemo(
    () => ({
      collapsed,
      setCollapsed,
      toggleCollapsed,
      mobileOpen,
      setMobileOpen,
      toggleMobileOpen,
    }),
    [collapsed, setCollapsed, toggleCollapsed, mobileOpen, toggleMobileOpen],
  );

  return (
    <NavChromeContext.Provider value={value}>
      {children}
    </NavChromeContext.Provider>
  );
}

export function useNavChrome(): NavChromeContextValue {
  const ctx = useContext(NavChromeContext);
  if (!ctx) {
    throw new Error("useNavChrome must be used within NavChromeProvider");
  }
  return ctx;
}

export function useNavChromeOptional(): NavChromeContextValue | null {
  return useContext(NavChromeContext);
}
