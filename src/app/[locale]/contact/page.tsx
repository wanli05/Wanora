import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/session";

/** Optional public contact mailbox — unset means 「準備中」. */
const CONTACT_EMAIL = process.env.WANORA_CONTACT_EMAIL?.trim() || "";

export default async function ContactPage() {
  const user = await getSessionUser(await headers());
  if (!user) redirect("/sign-in");
  const t = await getTranslations("ContactPage");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#084f49]">{t("title")}</h1>
        <p className="mt-2 text-sm text-zinc-600">{t("subtitle")}</p>
      </div>
      <section className="app-info-card">
        <h2 className="app-info-card-title">{t("topicsTitle")}</h2>
        <ul className="app-info-list">
          <li>{t("topicBug")}</li>
          <li>{t("topicFeature")}</li>
        </ul>
      </section>
      <section className="app-info-card">
        <h2 className="app-info-card-title">{t("howtoTitle")}</h2>
        <p className="text-sm leading-relaxed text-zinc-700">{t("howtoBody")}</p>
        <p className="mt-3 text-sm leading-relaxed text-zinc-700">
          {t("privacyNote")}
        </p>
      </section>
      <section className="app-info-card">
        <h2 className="app-info-card-title">{t("channelTitle")}</h2>
        {CONTACT_EMAIL ? (
          <p className="text-sm">
            <a
              className="text-[#0d6b63] underline-offset-2 hover:underline"
              href={`mailto:${CONTACT_EMAIL}`}
              data-testid="contact-mailto"
            >
              {t("mailtoCta")}
            </a>
          </p>
        ) : (
          <p className="text-sm text-zinc-600" data-testid="contact-pending">
            {t("pending")}
          </p>
        )}
      </section>
    </main>
  );
}
