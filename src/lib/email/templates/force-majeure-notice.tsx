// Email — notification force majeure (Sprint X.13 / Booking V1).
//
// Trigger : A23 `markForceMajeureAction` (super_admin only). Refund 100%
// (sauf décision contraire dans CGV) + reschedule prioritaire si souhaité.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName: string;
  interventionType: string;
  notes: string;
  bookingId: string;
}

const COPY = {
  fr: {
    title: "Force majeure — refund 100 %",
    intro: (n: string) => `Bonjour ${n},`,
    body: (i: string) =>
      `Suite à un événement de force majeure, votre intervention « ${i} » est annulée sans frais. Un remboursement complet sera traité sous 5 à 10 jours ouvrés.`,
    notesRow: (n: string) => `Précisions : ${n}`,
    next: "Si vous souhaitez reprogrammer, vous bénéficierez d'une priorité de planification dès que la situation le permettra. Répondez à cet email pour ouvrir un nouveau cadrage.",
    cta: "Nous contacter",
    refRow: (id: string) => `Référence : ${id}`,
  },
  en: {
    title: "Force majeure — 100% refund",
    intro: (n: string) => `Hello ${n},`,
    body: (i: string) =>
      `Following a force majeure event, your "${i}" session is cancelled at no cost. A full refund will be processed within 5 to 10 business days.`,
    notesRow: (n: string) => `Details: ${n}`,
    next: "If you wish to reschedule, you'll get priority scheduling as soon as the situation allows. Reply to this email to open a new scoping call.",
    cta: "Contact us",
    refRow: (id: string) => `Reference: ${id}`,
  },
} as const;

export const forceMajeureNoticeSubject = (locale: Locale, _p: Record<string, unknown>): string =>
  locale === "fr"
    ? "Force majeure — intervention annulée — Axion-IA"
    : "Force majeure — session cancelled — Axion-IA";

export function ForceMajeureNoticeEmail({
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
      <Text style={emailStyles.paragraphStyle}>{t.body(p.interventionType)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.notesRow(p.notes)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.next}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.refRow(p.bookingId)}
      </Text>
    </EmailLayout>
  );
}
