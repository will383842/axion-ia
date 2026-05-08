// Email — confirmation demande implementation (Sprint 15 / M8 step 4).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName: string;
  implType?: string;
  budget?: string;
  submissionId: string;
}

const COPY = {
  fr: {
    title: "Demande d'implémentation reçue",
    intro: (n: string) => `Bonjour ${n},`,
    body: (i: string | undefined, b: string | undefined) =>
      `Nous avons bien reçu votre demande d'implémentation${i ? ` (${i})` : ""}${b ? `, fourchette ${b}` : ""}. Notre équipe revient vers vous sous 48 heures ouvrées avec une proposition cadrée.`,
    next: "Délais types : 1 à 3 semaines automatisation simple, 6 à 10 semaines projet complet, 4 à 12 semaines IA custom. Tous nos déploiements sont hébergés sur infrastructure UE Hetzner conforme RGPD.",
    cta: "Cas concrets",
    refRow: (id: string) => `Référence : ${id}`,
  },
  en: {
    title: "Implementation request received",
    intro: (n: string) => `Hello ${n},`,
    body: (i: string | undefined, b: string | undefined) =>
      `We received your implementation request${i ? ` (${i})` : ""}${b ? `, ${b} budget range` : ""}. Our team gets back to you within 48 working hours with a scoped proposal.`,
    next: "Typical timelines: 1-3 weeks simple automation, 6-10 weeks complete project, 4-12 weeks custom AI. All our deployments are hosted on EU Hetzner infrastructure, GDPR-compliant.",
    cta: "Case studies",
    refRow: (id: string) => `Reference: ${id}`,
  },
} as const;

export const implementationConfirmedSubject = (
  locale: Locale,
  _p: Record<string, unknown>,
): string =>
  locale === "fr"
    ? "Demande d'implémentation reçue — Axion-IA"
    : "Implementation request received — Axion-IA";

export function ImplementationConfirmedEmail({
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
      cta={{ label: t.cta, href: `${baseUrl}/${locale}/cas-concrets` }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{t.intro(p.contactName)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.body(p.implType, p.budget)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.next}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.refRow(p.submissionId)}
      </Text>
    </EmailLayout>
  );
}
