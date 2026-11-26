import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { ContactForm } from "@/components/support/contact-form";
import { getSessionUser } from "@/lib/session";

export default async function ContactPage() {
  // Public: signed-out users may submit. Session is optional.
  await getSessionUser(await headers());
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
      <section className="app-info-card" data-testid="contact-form-section">
        <h2 className="app-info-card-title">{t("channelTitle")}</h2>
        <ContactForm />
      </section>
    </main>
  );
}
