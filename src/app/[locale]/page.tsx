import Link from "next/link";
import { useTranslations } from "next-intl";
import { APP_NAME } from "@/lib/app";

export default function Home() {
  const t = useTranslations("Home");
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-semibold tracking-tight">{APP_NAME}</h1>
      <p className="text-zinc-600 dark:text-zinc-400">{t("tagline")}</p>
      <Link
        href="/progress-demo"
        className="rounded bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        {t("demoCta")}
      </Link>
      <p className="max-w-md text-center text-sm text-zinc-500">{t("demoHint")}</p>
    </main>
  );
}
