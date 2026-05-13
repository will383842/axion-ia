// Email — notification de reprise (Sprint X.13 / D61).
//
// Trigger : A20 `resumeBookingAction`. Le nouveau slot est bloqué.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName: string;
  interventionType: string;
  resumedDate: string;
  resumedTime: string;
  bookingId: string;
}

const COPY = {
  fr: {
    title: "Intervention reprogrammée",
    intro: (n: string) => `Bonjour ${n},`,
    body: (i: string, d: string, t: string) =>
      `Votre intervention « ${i} » reprend du service. Nouvelle date verrouillée : le ${d} à ${t}.`,
    next: "Vous recevrez un email de préparation 7 jours avant la session avec l'agenda mis à jour.",
    cta: "Voir mon récapitulatif",
    refRow: (id: string) => `Référence : ${id}`,
  },
  en: {
    title: "Session rescheduled",
    intro: (n: string) => `Hello ${n},`,
    body: (i: string, d: string, t: string) =>
      `Your "${i}" session is back on track. New date locked: on ${d} at ${t}.`,
    next: "You'll receive a preparation email 7 days before the session with the updated agenda.",
    cta: "View my summary",
    refRow: (id: string) => `Reference: ${id}`,
  },
} as const;

export const bookingResumedNotificationSubject = (
  locale: Locale,
  p: Record<string, unknown>,
): string => {
  const d = (p as unknown as Payload).resumedDate;
  return locale === "fr"
    ? `Intervention reprogrammée — ${d} — Axion-IA`
    : `Session rescheduled — ${d} — Axion-IA`;
};

export function BookingResumedNotificationEmail({
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
        {t.body(p.interventionType, p.resumedDate, p.resumedTime)}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.next}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.refRow(p.bookingId)}
      </Text>
    </EmailLayout>
  );
}
