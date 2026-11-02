import type { Locale } from "@/lib/locale";
import type ja from "../../messages/ja.json";

export type Messages = typeof ja;

const loaders: Record<Locale, () => Promise<Messages>> = {
  ja: () => import("../../messages/ja.json").then((m) => m.default),
  "zh-CN": () => import("../../messages/zh-CN.json").then((m) => m.default),
  en: () => import("../../messages/en.json").then((m) => m.default),
};

export function loadMessages(locale: Locale): Promise<Messages> {
  return loaders[locale]();
}
