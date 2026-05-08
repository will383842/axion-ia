// Email — rappel option 48h H+24 (Sprint 15 / M8 step 4).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName: string;
  bookingDate: string;
  interventionType: string;
  expiresAt: string;
  optionId: string;
}

const COPY = {
  fr: {
    title: "Votre option expire dans 24h",
    intro: (n: string) => `Bonjour ${n},`,
    body: (d: string, i: string) =>
      `Petit rappel : votre option pour le ${d} (${i}) expire dans 24 heures. Notre équipe la valide ou la refuse avant l'échéance — vous serez prévenu(e).`,
    next: "Si vous souhaitez ajuster les modalités (participants, date alternative, contact admin), répondez à cet email.",
    cta: "Voir mon option",
  },
  en: {
    title: "Your option expires in 24h",
    intro: (n: string) => `Hello ${n},`,
    body: (d: string, i: string) =>
      `Quick reminder: your option for ${d} (${i}) expires in 24 hours. Our team validates or refuses before then — you'll be notified.`,
    next: "If you want to adjust details (participants, alternative date, admin contact), reply to this email.",
    cta: "View my option",
  },
} as const;

export const optionReminderSubject = (locale: Locale, _p: Record<string, unknown>): string =>
  locale === "fr"
    ? "Rappel : option 48h expire dans 24h — Axion-IA"
    : "Reminder: 48h option expires in 24h — Axion-IA";

export function OptionReminderEmail({
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
      cta={{ label: t.cta, href: `${baseUrl}/${locale}/confirmation?option=${p.optionId}` }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{t.intro(p.contactName)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.body(p.bookingDate, p.interventionType)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.next}</Text>
    </EmailLayout>
  );
}
