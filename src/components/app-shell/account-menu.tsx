"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { SignOutButton } from "@/app/[locale]/sign-out-button";

export function AccountMenu({
  label,
  initial,
  hasPhoto,
  collapsed,
}: {
  label: string;
  initial: string;
  hasPhoto: boolean;
  collapsed: boolean;
}) {
  const t = useTranslations("Account");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
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
    <div className="app-account" ref={rootRef}>
      <button
        type="button"
        className="app-account-trigger"
        data-testid="signed-in-as"
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="site-avatar"
          {...(!hasPhoto ? { "aria-hidden": true } : {})}
        >
          {hasPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- authenticated photo API
            <img
              src="/api/profile/photo"
              alt={t("photoAlt")}
              className="site-avatar-img"
            />
          ) : (
            <span className="site-avatar-fallback">
              {initial || t("avatarPlaceholder")}
            </span>
          )}
        </span>
        {!collapsed ? (
          <>
            <span className="app-account-name">{label}</span>
            <span className="app-account-caret" aria-hidden>
              {"\u25BE"}
            </span>
          </>
        ) : null}
      </button>
      {open ? (
        <div className="app-account-menu" role="menu">
          <div className="app-account-menu-item" role="none">
            <SignOutButton />
          </div>
        </div>
      ) : null}
    </div>
  );
}
