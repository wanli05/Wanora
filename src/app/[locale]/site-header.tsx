import Link from "next/link";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { APP_NAME } from "@/lib/app";
import { AccountStatus } from "./account-status";
import { LocaleSwitcher } from "./locale-switcher";

/** Signed-out chrome only — signed-in navigation lives in the left AppShell. */
export async function SiteHeader() {
  const t = await getTranslations("Nav");
  return (
    <header className="site-header" data-testid="site-header">
      <div className="site-header-row">
        <Link href="/" className="site-brand">
          {APP_NAME}
        </Link>
        <div className="site-header-right">
          <Link
            href="/contact"
            className="site-nav-link"
            data-testid="header-contact-link"
          >
            {t("contact")}
          </Link>
          <LocaleSwitcher />
          <Suspense fallback={null}>
            <AccountStatus />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
