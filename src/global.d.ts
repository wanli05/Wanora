import type { Messages } from "@/i18n/messages";
import type { Locale } from "@/lib/locale";

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
