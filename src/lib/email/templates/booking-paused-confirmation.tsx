// Email — confirmation de mise en pause (Sprint X.13 / D61).
//
// Trigger : A19 `pauseBookingAction`. Le slot est libéré pendant la pause.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName: string;
  interventionType: string;
  pausedAt: string;
  pausedUntil?: string;
  reason: string;
  bookingId: string;
}

const COPY = {
  fr: {
    title: "Intervention mise en pause",
    intro: (n: string) => `Bonjour ${n},`,
    body: (i: string, d: string) =>
      `Votre intervention « ${i} » est mise en pause à partir du ${d}, conformément à notre échange.`,
    reasonRow: (r: string) => `Motif : ${r}`,
    until: (u: string) => `Reprise indicative prévue le ${u}.`,
    undet: "Aucune date de reprise fixée pour l'instant — vous serez recontacté pour planifier.",
    nextSlot:
      "Le créneau initial est libéré et redevient disponible pour d'autres clients pendant la pause.",
    cta: "Voir mon dossier",
    refRow: (id: string) => `Référence : ${id}`,
  },
  en: {
    title: "Session paused",
    intro: (n: string) => `Hello ${n},`,
    body: (i: string, d: string) =>
      `Your "${i}" session is paused starting ${d}, per our agreement.`,
    reasonRow: (r: string) => `Reason: ${r}`,
    until: (u: string) => `Indicative resume scheduled for ${u}.`,
    undet: "No resume date set yet — you'll be contacted to schedule.",
    nextSlot:
      "The original slot is released and becomes available for other clients during the pause.",
    cta: "View my file",
    refRow: (id: string) => `Reference: ${id}`,
  },
} as const;

export const bookingPausedConfirmationSubject = (
  locale: Locale,
  _p: Record<string, unknown>,
): string =>
  locale === "fr" ? "Intervention mise en pause — Axion-IA" : "Session paused — Axion-IA";

export function BookingPausedConfirmationEmail({
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
      cta={{ label: t.cta, href: `${baseUrl}/${locale}/mes-donnees/booking/${p.bookingId}` }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{t.intro(p.contactName)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.body(p.interventionType, p.pausedAt)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.reasonRow(p.reason)}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {p.pausedUntil ? t.until(p.pausedUntil) : t.undet}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.nextSlot}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.refRow(p.bookingId)}
      </Text>
    </EmailLayout>
  );
}
