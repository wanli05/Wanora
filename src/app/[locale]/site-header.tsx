import Link from "next/link";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { APP_NAME } from "@/lib/app";
import { getSessionUser } from "@/lib/session";
import { AccountStatus } from "./account-status";
import { LocaleSwitcher } from "./locale-switcher";

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-lg font-semibold">
          {APP_NAME}
        </Link>
        <Suspense fallback={null}>
          <SignedInNav />
        </Suspense>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <LocaleSwitcher />
        <Suspense fallback={null}>
          <AccountStatus />
        </Suspense>
      </div>
    </header>
  );
}

async function SignedInNav() {
  const user = await getSessionUser(await headers());
  if (!user) return null;
  const t = await getTranslations("Nav");
  return (
    <nav className="flex items-center gap-3 text-sm">
      <Link href="/" className="underline">
        {t("progress")}
      </Link>
      <Link href="/profile" className="underline">
        {t("profile")}
      </Link>
    </nav>
  );
}
