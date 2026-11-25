import Link from "next/link";
import { Suspense } from "react";
import { APP_NAME } from "@/lib/app";
import { AccountStatus } from "./account-status";
import { LocaleSwitcher } from "./locale-switcher";

/** Signed-out chrome only — signed-in navigation lives in the left AppShell. */
export function SiteHeader() {
  return (
    <header className="site-header" data-testid="site-header">
      <div className="site-header-row">
        <Link href="/" className="site-brand">
          {APP_NAME}
        </Link>
        <div className="site-header-right">
          <LocaleSwitcher />
          <Suspense fallback={null}>
            <AccountStatus />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
