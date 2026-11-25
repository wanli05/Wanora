import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/session";
import { Landing } from "./landing";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const user = await getSessionUser(await headers());
  if (!user) return <Landing />;
  const t = await getTranslations("Home");
  const tNav = await getTranslations("Nav");
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#084f49]">{t("welcomeTitle")}</h1>
        <p className="mt-2 text-sm text-zinc-600">{t("welcomeBody")}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        <li>
          <Link href="/profile" className="home-link-card">
            <span className="home-link-card-title">{tNav("myCareer")}</span>
            <span className="home-link-card-sub">{t("linkCareer")}</span>
          </Link>
        </li>
        <li>
          <Link href="/progress" className="home-link-card">
            <span className="home-link-card-title">{tNav("progress")}</span>
            <span className="home-link-card-sub">{t("linkProgress")}</span>
          </Link>
        </li>
      </ul>
    </main>
  );
}
