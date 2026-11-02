"use server";

import { cookies, headers } from "next/headers";
import { getDb } from "@/db";
import { LOCALE_COOKIE } from "@/i18n/routing";
import { updateUiLocale } from "./data/users";
import { localeSchema, type Locale } from "./locale";
import { getSessionUser } from "./session";

async function setLocaleCookie(locale: Locale) {
  const { name, ...options } = LOCALE_COOKIE;
  (await cookies()).set(name, locale, options);
}

// Signed-in users also get the choice saved to their account.
export async function changeLocale(input: Locale): Promise<void> {
  const locale = localeSchema.parse(input);
  await setLocaleCookie(locale);
  const user = await getSessionUser(await headers());
  if (user) await updateUiLocale(getDb(), user.id, locale);
}

// After sign-in the account setting wins over the browser's cookie.
// Returns whether the UI language changed.
export async function applyAccountLocale(): Promise<boolean> {
  const user = await getSessionUser(await headers());
  if (!user) return false;
  const current = (await cookies()).get(LOCALE_COOKIE.name)?.value;
  if (current === user.uiLocale) return false;
  await setLocaleCookie(user.uiLocale);
  return true;
}
