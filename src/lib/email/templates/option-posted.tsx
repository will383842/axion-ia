// Email — confirmation option 48h posee (Sprint 15 / M8 step 4).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName: string;
  companyName: string;
  bookingDate: string;
  interventionType: string;
  expiresAt: string; // ISO
  optionId: string;
}

const COPY = {
  fr: {
    title: "Option 48h posée",
    intro: (n: string) => `Bonjour ${n},`,
    body: (c: string, d: string, i: string) =>
      `Votre option pour le ${d} (${i}) au nom de ${c} est enregistrée. Notre équipe valide ou refuse sous 48h.`,
    expires: (e: string) => `Expiration : ${e}.`,
    next: "Vous recevrez un rappel 24h avant l'expiration et un email final dès la décision admin.",
    cta: "Suivre mon option",
  },
  en: {
    title: "48-hour option placed",
    intro: (n: string) => `Hello ${n},`,
    body: (c: string, d: string, i: string) =>
      `Your option for ${d} (${i}) on behalf of ${c} is recorded. Our team validates or refuses within 48 hours.`,
    expires: (e: string) => `Expires: ${e}.`,
    next: "You will receive a reminder 24h before expiration and a final email once the admin decides.",
    cta: "Track my option",
  },
} as const;

export const optionPostedSubject = (locale: Locale, p: Record<string, unknown>): string => {
  const d = (p as unknown as Payload).bookingDate;
  return locale === "fr" ? `Option 48h sur le ${d} — Axion-IA` : `48h option on ${d} — Axion-IA`;
};

export function OptionPostedEmail({
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
      <Text style={emailStyles.paragraphStyle}>
        {t.body(p.companyName, p.bookingDate, p.interventionType)}
      </Text>
      <Text style={{ ...emailStyles.paragraphStyle, fontWeight: 500 }}>
        {t.expires(new Date(p.expiresAt).toLocaleString(locale))}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.next}</Text>
    </EmailLayout>
  );
}
