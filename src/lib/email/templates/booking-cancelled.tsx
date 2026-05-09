// Email — réservation ferme annulée par l'admin (Sprint 24 / C3).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName: string;
  bookingDate: string;
  interventionType: string;
  reason?: string;
}

const COPY = {
  fr: {
    title: "Réservation annulée",
    intro: (n: string) => `Bonjour ${n},`,
    body: (d: string, i: string) =>
      `Nous devons annuler votre réservation prévue le ${d} (${i}). Le créneau est à nouveau ouvert.`,
    reason: (r: string) => `Motif : ${r}.`,
    next: "Si vous souhaitez reprogrammer, nous serons heureux de vous proposer un nouveau créneau. Toutes nos excuses pour la gêne occasionnée.",
    cta: "Choisir un nouveau créneau",
  },
  en: {
    title: "Booking cancelled",
    intro: (n: string) => `Hello ${n},`,
    body: (d: string, i: string) =>
      `We have to cancel your booking scheduled on ${d} (${i}). The slot is open again.`,
    reason: (r: string) => `Reason: ${r}.`,
    next: "If you'd like to reschedule, we'd be glad to offer you a new slot. We sincerely apologise for the inconvenience.",
    cta: "Pick a new slot",
  },
} as const;

export const bookingCancelledSubject = (locale: Locale, _p: Record<string, unknown>): string =>
  locale === "fr" ? "Réservation annulée — Axion-IA" : "Booking cancelled — Axion-IA";

export function BookingCancelledEmail({
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
      cta={{ label: t.cta, href: `${baseUrl}/${locale}/${locale === "fr" ? "reserver" : "book"}` }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{t.intro(p.contactName)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.body(p.bookingDate, p.interventionType)}</Text>
      {p.reason && (
        <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
          {t.reason(p.reason)}
        </Text>
      )}
      <Text style={emailStyles.paragraphStyle}>{t.next}</Text>
    </EmailLayout>
  );
}
