// Email — booking validé sur le calendrier (Sprint X.13 / Booking V1).
//
// Trigger : clic Will 2 "Valider sur le calendrier" (X.4
// validateBookingOnCalendarAction). Le slot bascule en 🔴, l'intervention
// est officiellement verrouillée.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName: string;
  interventionType: string;
  bookingDate: string;
  bookingTime: string;
  participantsCount: number;
  bookingId: string;
}

const COPY = {
  fr: {
    title: "Intervention verrouillée dans le calendrier",
    intro: (n: string) => `Bonjour ${n},`,
    body: (i: string, d: string, t: string, p: number) =>
      `Votre intervention « ${i} » est confirmée et verrouillée dans le calendrier : le ${d} à ${t}, ${p} participant(s).`,
    next: "Vous recevrez un email de préparation 7 jours avant la session avec l'agenda détaillé et les éléments à préparer.",
    cta: "Voir mon récapitulatif",
    refRow: (id: string) => `Référence : ${id}`,
  },
  en: {
    title: "Session locked in the calendar",
    intro: (n: string) => `Hello ${n},`,
    body: (i: string, d: string, t: string, p: number) =>
      `Your "${i}" session is confirmed and locked in the calendar: on ${d} at ${t}, ${p} participant(s).`,
    next: "You'll receive a preparation email 7 days before the session with the detailed agenda and items to prepare.",
    cta: "View my summary",
    refRow: (id: string) => `Reference: ${id}`,
  },
} as const;

export const bookingValidatedOnCalendarSubject = (
  locale: Locale,
  p: Record<string, unknown>,
): string => {
  const d = (p as unknown as Payload).bookingDate;
  return locale === "fr"
    ? `Intervention Axion-IA confirmée — ${d}`
    : `Axion-IA session confirmed — ${d}`;
};

export function BookingValidatedOnCalendarEmail({
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
