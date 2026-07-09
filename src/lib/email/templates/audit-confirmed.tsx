// Email — confirmation demande audit (Sprint 15 / M8 step 4).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName: string;
  auditType?: string;
  size?: string;
  industry?: string;
  submissionId: string;
}

const COPY = {
  fr: {
    title: "Demande d'audit reçue",
    intro: (n: string) => `Bonjour ${n},`,
    body: (a: string | undefined, s: string | undefined, i: string | undefined) =>
      `Nous avons bien reçu votre demande d'audit${a ? ` (${a})` : ""}${s ? ` pour entreprise ${s}` : ""}${i ? ` — secteur ${i}` : ""}. Notre équipe revient vers vous sous 48 heures ouvrées avec un calendrier de mission.`,
    next: "L'audit dure 5 à 10 jours selon le périmètre. Vous recevrez un rapport actionnable avec quick-wins chiffrés et un plan d'action 90 jours.",
    cta: "Méthodologie d'audit",
    refRow: (id: string) => `Référence : ${id}`,
  },
  en: {
    title: "Audit request received",
    intro: (n: string) => `Hello ${n},`,
    body: (a: string | undefined, s: string | undefined, i: string | undefined) =>
      `We received your audit request${a ? ` (${a})` : ""}${s ? ` for ${s} company` : ""}${i ? ` — ${i} sector` : ""}. Our team gets back to you within 48 working hours with a mission calendar.`,
    next: "The audit takes 5 to 10 days depending on scope. You'll receive an actionable report with quantified quick-wins and a 90-day action plan.",
    cta: "Audit methodology",
    refRow: (id: string) => `Reference: ${id}`,
  },
} as const;

export const auditConfirmedSubject = (locale: Locale, _p: Record<string, unknown>): string =>
  locale === "fr" ? "Demande d'audit reçue — Axion-IA" : "Audit request received — Axion-IA";

export function AuditConfirmedEmail({
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
      cta={{ label: t.cta, href: `${baseUrl}/${locale}/methodologie` }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{t.intro(p.contactName)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.body(p.auditType, p.size, p.industry)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.next}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.refRow(p.submissionId)}
      </Text>
    </EmailLayout>
  );
}
