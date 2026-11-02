import { useTranslations } from "next-intl";
import { APP_NAME } from "@/lib/app";

export default function Home() {
  const t = useTranslations("Home");
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-semibold tracking-tight">{APP_NAME}</h1>
      <p className="text-zinc-600 dark:text-zinc-400">{t("tagline")}</p>
    </main>
  );
}
