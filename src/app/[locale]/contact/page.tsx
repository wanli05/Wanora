import { getTranslations } from "next-intl/server";
import { ContactForm } from "@/components/support/contact-form";

/**
 * Public contact page — no session lookup.
 * Avoid getSessionUser/headers() here so the route can prerender / navigate instantly.
 */
export default async function ContactPage() {
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
