"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { APP_NAME } from "@/lib/app";
import { useNavChrome } from "@/components/app-shell/nav-chrome-context";
import { AccountMenu } from "@/components/app-shell/account-menu";
import {
  IconCareer,
  IconCollapse,
  IconContact,
  IconExpand,
  IconHome,
  IconProgress,
  IconSettings,
  IconVersion,
} from "@/components/app-shell/nav-icons";

export type AppSidebarIdentity = {
  label: string;
  initial: string;
  hasPhoto: boolean;
};

type NavItem = {
  id: string;
  href: string;
  label: string;
  icon: typeof IconHome;
  match: (pathname: string) => boolean;
};

export function AppSidebar({ identity }: { identity: AppSidebarIdentity }) {
  const t = useTranslations("Nav");
  const pathname = usePathname() || "/";
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } =
    useNavChrome();

  const items: NavItem[] = [
    {
      id: "home",
      href: "/",
      label: t("home"),
      icon: IconHome,
      match: (p) => p === "/",
    },
    {
      id: "career",
      href: "/profile",
      label: t("myCareer"),
      icon: IconCareer,
      match: (p) => p === "/profile" || p.startsWith("/profile/"),
    },
    {
      id: "progress",
      href: "/progress",
      label: t("progress"),
      icon: IconProgress,
      match: (p) =>
        p === "/progress" ||
        p.startsWith("/progress/") ||
        p.startsWith("/applications/"),
    },
    {
      id: "version",
      href: "/version",
      label: t("version"),
      icon: IconVersion,
      match: (p) => p === "/version" || p.startsWith("/version/"),
    },
    {
      id: "contact",
      href: "/contact",
      label: t("contact"),
      icon: IconContact,
      match: (p) => p === "/contact" || p.startsWith("/contact/"),
    },
  ];

  const settingsActive =
    pathname === "/settings" || pathname.startsWith("/settings/");

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="app-sidebar-backdrop"
          aria-label={t("closeNav")}
          onClick={closeMobile}
        />
      ) : null}
      <aside
        id="app-sidebar"
        className="app-sidebar"
        data-testid="app-sidebar"
        data-collapsed={collapsed ? "true" : "false"}
        data-mobile-open={mobileOpen ? "true" : "false"}
        aria-label={t("primary")}
      >
        <div className="app-sidebar-top">
          <Link
            href="/"
            className="app-sidebar-brand"
            title={APP_NAME}
            onClick={closeMobile}
          >
            <span className="app-sidebar-brand-mark" aria-hidden>
              {APP_NAME.slice(0, 1)}
            </span>
            {!collapsed ? <span>{APP_NAME}</span> : null}
          </Link>
          <button
            type="button"
            className="app-sidebar-collapse"
            data-testid="app-sidebar-collapse"
            aria-pressed={collapsed}
            title={collapsed ? t("expandNav") : t("collapseNav")}
            aria-label={collapsed ? t("expandNav") : t("collapseNav")}
            onClick={toggleCollapsed}
          >
            {collapsed ? <IconExpand /> : <IconCollapse />}
          </button>
        </div>

        <nav className="app-sidebar-nav">
          {items.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                className="app-sidebar-link"
                data-active={active ? "true" : "false"}
                aria-current={active ? "page" : undefined}
                title={item.label}
                onClick={closeMobile}
              >
                <Icon />
                {!collapsed ? <span>{item.label}</span> : null}
                {collapsed ? <span className="sr-only">{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className="app-sidebar-bottom">
          <Link
            href="/settings"
            className="app-sidebar-link"
            data-active={settingsActive ? "true" : "false"}
            aria-current={settingsActive ? "page" : undefined}
            title={t("settings")}
            onClick={closeMobile}
          >
            <IconSettings />
            {!collapsed ? <span>{t("settings")}</span> : null}
            {collapsed ? <span className="sr-only">{t("settings")}</span> : null}
          </Link>
          <AccountMenu
            label={identity.label}
            initial={identity.initial}
            hasPhoto={identity.hasPhoto}
            collapsed={collapsed}
          />
        </div>
      </aside>
    </>
  );
}
