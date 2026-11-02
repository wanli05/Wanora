import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/locale";

export const LOCALE_COOKIE = {
  name: "NEXT_LOCALE",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax",
  path: "/",
} as const;

// URLs carry no locale prefix: the proxy picks the locale from the cookie,
// then Accept-Language, and rewrites internally to /[locale]/...
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "never",
  localeCookie: LOCALE_COOKIE,
  alternateLinks: false,
});
