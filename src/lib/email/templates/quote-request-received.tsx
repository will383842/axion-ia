// Email — accusé de réception demande devis (Sprint X.5bis / Booking V1).
//
// Parcours B (D44) : visiteur soumet `/demande-devis` → submission qualifiée
// → email de confirmation avec ETA 48h pour cadrage Will (négo libre, pas
// d'ETA ferme).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName: string;
  companyName: string;
  submissionId: string;
}

const COPY = {
  fr: {
    title: "Demande de devis reçue",
    intro: (n: string) => `Bonjour ${n},`,
    body: (company: string) =>
      `Nous avons bien reçu votre demande de devis pour ${company}. Williams vous recontactera sous 48 heures ouvrées pour un appel de cadrage personnalisé.`,
    next: "Pendant ce temps, vous pouvez consulter nos formats standards ou nos cas concrets pour préciser votre besoin.",
    cta: "Voir les formats",
    refRow: (id: string) => `Référence : ${id}`,
  },
  en: {
    title: "Quote request received",
    intro: (n: string) => `Hello ${n},`,
    body: (company: string) =>
      `We received your quote request for ${company}. Williams will get back to you within 48 business hours for a personalized scoping call.`,
    next: "In the meantime, you can browse our standard formats or case studies to refine your needs.",
    cta: "See formats",
    refRow: (id: string) => `Reference: ${id}`,
  },
} as const;

export const quoteRequestReceivedSubject = (locale: Locale, _p: Record<string, unknown>): string =>
  locale === "fr" ? "Demande de devis reçue — Axion-IA" : "Quote request received — Axion-IA";

export function QuoteRequestReceivedEmail({
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
      <Text style={emailStyles.paragraphStyle}>{t.body(p.companyName)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.next}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.refRow(p.submissionId)}
      </Text>
    </EmailLayout>
  );
}
