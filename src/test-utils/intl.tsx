import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import en from "../../messages/en.json";
import ja from "../../messages/ja.json";
import zhCN from "../../messages/zh-CN.json";
import type { Locale } from "@/lib/locale";

const messages = { ja, "zh-CN": zhCN, en } as const;

function wrap(ui: ReactElement, locale: Locale) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages[locale]}
      timeZone="Asia/Tokyo"
    >
      {ui}
    </NextIntlClientProvider>
  );
}

export function renderWithIntl(ui: ReactElement, locale: Locale = "ja") {
  const result = render(wrap(ui, locale));
  return {
    ...result,
    rerender: (next: ReactElement) => result.rerender(wrap(next, locale)),
  };
}
