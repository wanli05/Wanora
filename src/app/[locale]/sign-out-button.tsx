"use client";

import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import { loadPage } from "@/lib/reload";

export function SignOutButton() {
  const t = useTranslations("Account");
  return (
    <button
      type="button"
      className="site-logout"
      onClick={async () => {
        await authClient.signOut();
        // Full reload drops all client state of the previous user, including
        // pages Next.js keeps hidden for back/forward navigation.
        loadPage("/");
      }}
    >
      {t("signOut")}
    </button>
  );
}
