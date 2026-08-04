// Email — devis signé (Sprint X.7 / Booking V1).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName: string;
  quoteNumber: string;
}

const COPY = {
  fr: {
    title: "Devis signé — passons au contrat",
    intro: (n: string) => `Bonjour ${n},`,
    body: (q: string) =>
      `Votre devis ${q} est bien signé. Excellent. Nous passons maintenant à l'étape contrat + facture d'acompte, que vous recevrez sous 24-48 h ouvrées par email séparé.`,
    next: "L'intervention ne sera officiellement verrouillée dans notre calendrier qu'après réception de l'acompte (D50-D51).",
    cta: "Nous contacter",
  },
  en: {
    title: "Quote signed — moving to contract",
    intro: (n: string) => `Hello ${n},`,
    body: (q: string) =>
      `Your quote ${q} is signed. Excellent. We now move to the contract + deposit invoice step, which you'll receive within 24-48 business hours by separate email.`,
    next: "The session will only be officially locked in our calendar after the deposit is received (D50-D51).",
    cta: "Contact us",
  },
} as const;

export const quoteSignedSubject = (locale: Locale, p: Record<string, unknown>): string => {
  const q = (p as unknown as Payload).quoteNumber;
  return locale === "fr"
    ? `Devis ${q} signé — étape contrat — Axion-IA`
    : `Quote ${q} signed — contract step — Axion-IA`;
};

export function QuoteSignedEmail({
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
      cta={{ label: t.cta, href: `${baseUrl}/${locale}/contact` }}
      locale={locale}
      trust
    >
      <Text style={emailStyles.paragraphStyle}>{t.intro(p.contactName)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.body(p.quoteNumber)}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.next}
      </Text>
    </EmailLayout>
  );
}
