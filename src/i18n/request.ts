import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import { chargerMessagesGabarits } from "./messages-gabarits";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const messages = (await import(`../messages/${locale}.json`)).default as Record<string, unknown>;
  // Gabarits d'articles (S2) : un fichier par gabarit, fusionnés sous `articleGabarits`.
  return { locale, messages: { ...messages, ...(await chargerMessagesGabarits(locale)) } };
});
