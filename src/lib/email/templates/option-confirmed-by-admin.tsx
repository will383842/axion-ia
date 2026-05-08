// Email — option confirmee par l'admin → devient booking ferme (Sprint 15).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName: string;
  bookingDate: string;
  interventionType: string;
  bookingId: string;
}

const COPY = {
  fr: {
    title: "Option confirmée — votre intervention est réservée",
    intro: (n: string) => `Bonjour ${n},`,
    body: (d: string, i: string) =>
      `Excellente nouvelle : votre option pour le ${d} (${i}) vient d'être validée par notre équipe. Votre intervention est désormais confirmée.`,
    next: "Vous recevrez un email de préparation 48h avant la session avec l'agenda détaillé et les éléments à apporter.",
    cta: "Voir mon récapitulatif",
  },
  en: {
    title: "Option confirmed — your session is booked",
    intro: (n: string) => `Hello ${n},`,
    body: (d: string, i: string) =>
      `Great news: your option for ${d} (${i}) has just been validated by our team. Your session is now confirmed.`,
    next: "You will receive a preparation email 48h before the session with the detailed agenda and items to bring.",
    cta: "View my summary",
  },
} as const;

export const optionConfirmedByAdminSubject = (
  locale: Locale,
  _p: Record<string, unknown>,
): string =>
  locale === "fr"
    ? "Option confirmée — intervention Axion-IA réservée"
    : "Option confirmed — Axion-IA session booked";

export function OptionConfirmedByAdminEmail({
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
      <Text style={emailStyles.paragraphStyle}>{t.body(p.bookingDate, p.interventionType)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.next}</Text>
    </EmailLayout>
  );
}
