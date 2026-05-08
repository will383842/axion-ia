// Email — option 48h expiree (Sprint 15 / M8 step 4).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName: string;
  bookingDate: string;
  interventionType: string;
}

const COPY = {
  fr: {
    title: "Option 48h expirée",
    intro: (n: string) => `Bonjour ${n},`,
    body: (d: string, i: string) =>
      `Votre option pour le ${d} (${i}) a expiré sans validation admin. Le créneau redevient disponible pour d'autres entreprises.`,
    next: "Si vous souhaitez relancer la démarche, vous pouvez reposer une nouvelle option ou nous écrire pour fixer un créneau alternatif.",
    cta: "Choisir un autre créneau",
  },
  en: {
    title: "48h option expired",
    intro: (n: string) => `Hello ${n},`,
    body: (d: string, i: string) =>
      `Your option for ${d} (${i}) expired without admin validation. The slot is now available again for other companies.`,
    next: "If you want to start over, you can place a new option or contact us to set an alternative slot.",
    cta: "Pick another slot",
  },
} as const;

export const optionExpiredSubject = (locale: Locale, _p: Record<string, unknown>): string =>
  locale === "fr" ? "Option 48h expirée — Axion-IA" : "48h option expired — Axion-IA";

export function OptionExpiredEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const t = COPY[locale];
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  return (
    <EmailLayout
      preview={t.title}
      title={t.title}
      cta={{ label: t.cta, href: `${baseUrl}/${locale}/interventions` }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{t.intro(p.contactName)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.body(p.bookingDate, p.interventionType)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.next}</Text>
    </EmailLayout>
  );
}
