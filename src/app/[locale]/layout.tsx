import type { Metadata } from "next";
import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { APP_NAME } from "@/lib/app";
import { LOCALES } from "@/lib/locale";
import { AiSidebarHost } from "@/components/ai-sidebar/ai-sidebar-host";
import { SiteHeader } from "./site-header";
// Self-hosted via npm — avoids next/font/google + Turbopack fetch failures
// when fonts.googleapis.com is slow/unreachable (broken virtual font modules).
import "@fontsource-variable/newsreader";
import "@fontsource-variable/noto-sans-jp";
import "@fontsource-variable/noto-sans-sc";
import "./globals.css";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return {
    title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
    description: t("description"),
  };
}

export default async function LocaleLayout({
  children,
}: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SiteHeader />
          {children}
          <Suspense fallback={null}>
            <AiSidebarHost />
          </Suspense>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
