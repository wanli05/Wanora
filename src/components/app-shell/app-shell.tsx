"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  NavChromeProvider,
  useNavChrome,
} from "@/components/app-shell/nav-chrome-context";
import {
  AppSidebar,
  type AppSidebarIdentity,
} from "@/components/app-shell/app-sidebar";
import { IconMenu } from "@/components/app-shell/nav-icons";

function ShellInner({
  children,
  identity,
}: {
  children: ReactNode;
  identity: AppSidebarIdentity;
}) {
  const t = useTranslations("Nav");
  const { collapsed, mobileOpen, toggleMobileOpen, setMobileOpen } =
    useNavChrome();

  return (
    <div
      className="app-shell"
      data-nav-collapsed={collapsed ? "true" : "false"}
      data-mobile-nav={mobileOpen ? "open" : "closed"}
    >
      <AppSidebar identity={identity} />
      <div className="app-shell-main">
        <div className="app-mobile-bar">
          <button
            type="button"
            className="app-mobile-menu"
            data-testid="app-mobile-menu"
            aria-expanded={mobileOpen}
            aria-controls="app-sidebar"
            aria-label={t("openNav")}
            onClick={toggleMobileOpen}
          >
            <IconMenu />
          </button>
        </div>
        <div
          className="app-shell-content"
          onClick={() => {
            if (mobileOpen) setMobileOpen(false);
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function AppShell({
  children,
  identity,
}: {
  children: ReactNode;
  identity: AppSidebarIdentity;
}) {
  return (
    <NavChromeProvider>
      <ShellInner identity={identity}>{children}</ShellInner>
    </NavChromeProvider>
  );
}
