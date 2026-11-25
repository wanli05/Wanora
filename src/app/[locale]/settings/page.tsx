import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/session";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const user = await getSessionUser(await headers());
  if (!user) redirect("/sign-in");
  const t = await getTranslations("SettingsPage");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#084f49]">{t("title")}</h1>
        <p className="mt-2 text-sm text-zinc-600">{t("subtitle")}</p>
      </div>
      <SettingsForm />
    </main>
  );
}
