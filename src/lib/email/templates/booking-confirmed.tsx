// Email — confirmation reservation intervention (Sprint 15 / M8 step 4).
//
// Trigger : Server Action createBookingAction.
// Contenu : recapitulatif date/heure/intervention/participants + CTA prep doc.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName: string;
  bookingDate: string; // YYYY-MM-DD
  bookingTime: string; // HH:MM
  interventionType: string;
  participantsCount: number;
  bookingId: string;
}

const COPY = {
  fr: {
    title: "Votre intervention est réservée",
    intro: (n: string) => `Bonjour ${n},`,
    body: (i: string, d: string, t: string, p: number) =>
      `Votre intervention « ${i} » est confirmée pour le ${d} à ${t}, ${p} participant(s).`,
    next: "Vous recevrez un email de préparation 48h avant la session avec l'agenda détaillé et les éléments à apporter.",
    cta: "Voir mon récapitulatif",
    refRow: (id: string) => `Référence : ${id}`,
  },
  en: {
    title: "Your session is booked",
    intro: (n: string) => `Hello ${n},`,
    body: (i: string, d: string, t: string, p: number) =>
      `Your "${i}" session is confirmed on ${d} at ${t}, ${p} participant(s).`,
    next: "You will receive a preparation email 48h before the session with the detailed agenda and items to bring.",
    cta: "View my summary",
    refRow: (id: string) => `Reference: ${id}`,
  },
} as const;

export const bookingConfirmedSubject = (locale: Locale, p: Record<string, unknown>): string => {
  const date = (p as unknown as Payload).bookingDate;
  return locale === "fr"
    ? `Votre intervention Axion-IA est réservée — ${date}`
    : `Your Axion-IA session is booked — ${date}`;
};

export function BookingConfirmedEmail({
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
      cta={{ label: t.cta, href: `${baseUrl}/${locale}/confirmation?id=${p.bookingId}` }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{t.intro(p.contactName)}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {t.body(p.interventionType, p.bookingDate, p.bookingTime, p.participantsCount)}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.next}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.refRow(p.bookingId)}
      </Text>
    </EmailLayout>
  );
}
