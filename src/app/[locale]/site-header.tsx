import Link from "next/link";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { APP_NAME } from "@/lib/app";
import { AccountStatus } from "./account-status";
import { LocaleSwitcher } from "./locale-switcher";

export async function SiteHeader() {
  const t = await getTranslations("Nav");
  return (
    <header className="flex items-center justify-between gap-4 border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-lg font-semibold">
          {APP_NAME}
        </Link>
        <Link href="/progress-demo" className="text-sm text-zinc-600 underline dark:text-zinc-400">
          {t("progress")}
        </Link>
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
