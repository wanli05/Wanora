import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { APP_NAME } from "@/lib/app";
import { APP_VERSION } from "@/lib/app-version";
import { getSessionUser } from "@/lib/session";

export default async function VersionPage() {
  const user = await getSessionUser(await headers());
  if (!user) redirect("/sign-in");
  const t = await getTranslations("VersionPage");

  const updates = [
    t("updateSkillsTable"),
    t("updateCollapsedForms"),
    t("updateExportSkills"),
    t("updateShellNav"),
  ];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#084f49]">{t("title")}</h1>
        <p className="mt-2 text-sm text-zinc-600">{t("subtitle")}</p>
      </div>
      <section className="app-info-card">
        <h2 className="app-info-card-title">{t("currentVersion")}</h2>
        <p className="app-info-version" data-testid="app-version">
          {APP_NAME} {APP_VERSION}
        </p>
      </section>
      <section className="app-info-card">
        <h2 className="app-info-card-title">{t("changelogTitle")}</h2>
        <ul className="app-info-list">
          {updates.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
