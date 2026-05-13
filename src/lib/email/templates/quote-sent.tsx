// Email — devis envoyé (Sprint X.7 / Booking V1).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName: string;
  quoteNumber: string;
  amountTtc: string;
  validUntil: string;
  pdfUrl?: string;
}

const COPY = {
  fr: {
    title: "Devis envoyé",
    intro: (n: string) => `Bonjour ${n},`,
    body: (q: string, a: string) => `Votre devis ${q} est prêt — montant ${a}.`,
    validity: (d: string) => `Validité : ${d}. Au-delà, un nouveau devis sera émis.`,
    next: "Vous pouvez le consulter et le signer via le lien ci-dessous. Pour toute question, répondez directement à cet email.",
    cta: "Voir le devis",
    ctaNoLink: "Nous contacter",
  },
  en: {
    title: "Quote sent",
    intro: (n: string) => `Hello ${n},`,
    body: (q: string, a: string) => `Your quote ${q} is ready — amount ${a}.`,
    validity: (d: string) => `Valid until: ${d}. After that, a new quote will be issued.`,
    next: "You can review and sign it via the link below. For any question, reply directly to this email.",
    cta: "View quote",
    ctaNoLink: "Contact us",
  },
} as const;

export const quoteSentSubject = (locale: Locale, p: Record<string, unknown>): string => {
  const q = (p as unknown as Payload).quoteNumber;
  return locale === "fr" ? `Devis ${q} — Axion-IA` : `Quote ${q} — Axion-IA`;
};

export function QuoteSentEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const t = COPY[locale];
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const cta = p.pdfUrl
    ? { label: t.cta, href: p.pdfUrl }
    : { label: t.ctaNoLink, href: `${baseUrl}/${locale}/contact` };
  return (
    <EmailLayout preview={t.title} title={t.title} cta={cta} locale={locale}>
      <Text style={emailStyles.paragraphStyle}>{t.intro(p.contactName)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.body(p.quoteNumber, p.amountTtc)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.validity(p.validUntil)}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.next}
      </Text>
    </EmailLayout>
  );
}
