import { getTranslations } from "next-intl/server";

export const instant = false;

export default async function ProfileLayout({ children }: LayoutProps<"/[locale]/profile">) {
  const t = await getTranslations("MyCareer");
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#084f49]">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("subtitle")}</p>
      </div>
      {children}
    </main>
  );
}
