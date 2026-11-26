import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { ContactForm } from "@/components/support/contact-form";
import { getSessionUser } from "@/lib/session";

export default async function ContactPage() {
  // Public: signed-out users may submit. Session is optional.
  await getSessionUser(await headers());
  const t = await getTranslations("ContactPage");

  return (
    <main
      className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6"
      data-testid="contact-page"
    >
      <h1 className="text-2xl font-semibold text-[#084f49]">{t("title")}</h1>
      <section data-testid="contact-form-section">
        <ContactForm />
      </section>
    </main>
  );
}
