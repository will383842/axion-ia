// Email — accusé de réception demande devis (Sprint X.5bis / Booking V1).
//
// Parcours B (D44) : visiteur soumet une demande de devis → submission
// qualifiée → accusé de réception.
//
// ── Deux corrections du 2026-08-13 ───────────────────────────────────────
// 1. Ce gabarit était écrit, déclaré… et APPELÉ NULLE PART. Les demandes de
//    devis retombaient sur `contact-confirmed`, l'accusé générique. Il est
//    désormais branché sur le type `devis` du contact unifié.
// 2. Le délai annoncé était « 24 à 48 heures ouvrées », soit une promesse
//    PLUS STRICTE que celle de l'accusé générique déjà envoyé aujourd'hui
//    (48 heures). L'activer tel quel aurait créé un engagement nouveau, sans
//    que personne ne l'ait décidé. Aligné sur 48 heures — la promesse
//    existante, tenue, et suffisante.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName: string;
  /** Facultative : le formulaire ne l'exige pas. */
  companyName?: string;
  submissionId: string;
}

const COPY = {
  fr: {
    title: "Demande de devis reçue",
    preview: "Réponse sous 48 heures ouvrées pour un appel de cadrage.",
    intro: (n: string) => `Bonjour ${n},`,
    // 🔴 L'entreprise est FACULTATIVE dans le formulaire. Sans ce repli, la
    // phrase devenait « votre demande de devis pour undefined ».
    body: (company: string | undefined) =>
      company
        ? `Nous avons bien reçu votre demande de devis pour ${company}. Nous revenons vers vous sous 48 heures ouvrées pour un appel de cadrage.`
        : `Nous avons bien reçu votre demande de devis. Nous revenons vers vous sous 48 heures ouvrées pour un appel de cadrage.`,
    next: "Pendant ce temps, vous pouvez consulter nos formats standards ou nos cas concrets pour préciser votre besoin.",
    cta: "Voir les formats",
    refRow: (id: string) => `Référence : ${id}`,
  },
  en: {
    title: "Quote request received",
    preview: "Reply within 48 working hours for a scoping call.",
    intro: (n: string) => `Hello ${n},`,
    body: (company: string | undefined) =>
      company
        ? `We received your quote request for ${company}. We will get back to you within 48 working hours for a scoping call.`
        : `We received your quote request. We will get back to you within 48 working hours for a scoping call.`,
    next: "In the meantime, you can browse our standard formats or case studies to refine your needs.",
    cta: "See formats",
    refRow: (id: string) => `Reference: ${id}`,
  },
} as const;

export const quoteRequestReceivedSubject = (locale: Locale, _p: Record<string, unknown>): string =>
  locale === "fr" ? "Demande de devis reçue" : "Quote request received";

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
      famille="B"
      preview={t.preview}
      title={t.title}
      cta={{ label: t.cta, href: `${baseUrl}/${locale}/interventions` }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{t.body(p.companyName)}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {t.intro(p.contactName)}
        <br />
        {t.next}
      </Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.refRow(p.submissionId)}
      </Text>
    </EmailLayout>
  );
}
