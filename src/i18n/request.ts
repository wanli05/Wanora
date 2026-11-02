import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { getRequestConfig } from "next-intl/server";
import { isLocale } from "@/lib/locale";
import { loadMessages } from "./messages";

export default getRequestConfig(async ({ locale: explicit }) => {
  const locale = explicit ?? (await rootLocale());
  if (!isLocale(locale)) notFound();
  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: "Asia/Tokyo",
  };
});
