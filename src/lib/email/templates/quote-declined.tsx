// Email — devis refusé/expiré (Sprint X.7 / Booking V1).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName: string;
  quoteNumber: string;
  reason?: string;
}

const COPY = {
  fr: {
    title: "Devis non retenu",
    intro: (n: string) => `Bonjour ${n},`,
    body: (q: string) => `Votre devis ${q} a été marqué comme non retenu. Aucun frais n'est dû.`,
    reasonRow: (r: string) => `Motif : ${r}`,
    next: "Si vous souhaitez explorer d'autres formats ou ajuster le périmètre, n'hésitez pas à nous écrire — nous pouvons proposer un nouveau cadrage.",
    cta: "Nous contacter",
  },
  en: {
    title: "Quote not retained",
    intro: (n: string) => `Hello ${n},`,
    body: (q: string) => `Your quote ${q} has been marked as not retained. No fees due.`,
    reasonRow: (r: string) => `Reason: ${r}`,
    next: "If you wish to explore other formats or adjust the scope, feel free to write to us — we can propose a new scoping call.",
    cta: "Contact us",
  },
} as const;

export const quoteDeclinedSubject = (locale: Locale, p: Record<string, unknown>): string => {
  const q = (p as unknown as Payload).quoteNumber;
  return locale === "fr"
    ? `Devis ${q} non retenu — Axion-IA`
    : `Quote ${q} not retained — Axion-IA`;
};

export function QuoteDeclinedEmail({
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
    >
      <Text style={emailStyles.paragraphStyle}>{t.intro(p.contactName)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.body(p.quoteNumber)}</Text>
      {p.reason ? <Text style={emailStyles.paragraphStyle}>{t.reasonRow(p.reason)}</Text> : null}
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.next}
      </Text>
    </EmailLayout>
  );
}
