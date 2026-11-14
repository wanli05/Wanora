import Link from "next/link";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { APP_NAME } from "@/lib/app";
import { getSessionUser } from "@/lib/session";
import { AccountStatus } from "./account-status";
import { LocaleSwitcher } from "./locale-switcher";
import { SiteNavLinks } from "./site-nav-links";

export function SiteHeader() {
  return (
    <header className="site-header" data-testid="site-header">
      <div className="site-header-row">
        <Link href="/" className="site-brand">
          {APP_NAME}
        </Link>
        <Suspense fallback={null}>
          <SignedInNav />
        </Suspense>
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

async function SignedInNav() {
  const user = await getSessionUser(await headers());
  if (!user) return null;
  const t = await getTranslations("Nav");
  return (
    <SiteNavLinks
      progressLabel={t("progress")}
      myCareerLabel={t("myCareer")}
      ariaLabel={t("primary")}
    />
  );
}
