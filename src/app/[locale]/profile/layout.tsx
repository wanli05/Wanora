import { getTranslations } from "next-intl/server";

export const instant = false;

export default async function ProfileLayout({ children }: LayoutProps<"/[locale]/profile">) {
  const t = await getTranslations("Profile");
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("subtitle")}</p>
      </div>
      {children}
    </main>
  );
}
