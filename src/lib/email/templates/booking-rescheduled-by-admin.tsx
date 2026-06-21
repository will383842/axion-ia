// Email — Réservation déplacée à notre initiative (RELATION-CLIENT).
//
// On a dû modifier la date d'une intervention/réservation côté Axion-IA :
// on s'excuse avec tact, on annonce la nouvelle date, on reste disponible.
// AUCUNE mention de paiement / carte / Stripe. Pas de CTA dur (« Nous contacter »).
//
// Payload ci-dessous = forme attendue (fallbacks robustes via `field()`).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";

interface Payload {
  contactName: string;
  /** Intitulé de la prestation. Ex. « Formation IA — 1 jour ». */
  interventionType?: string;
  /** Date initialement prévue (formatée). Ex. « 20/05/2026 ». */
  bookingDate?: string;
  /** Nouvelle date proposée (formatée). Ex. « 27/05/2026 ». */
  newDate?: string;
  /** URL pour réagir / nous joindre. Défaut : page contact. */
  feedbackUrl?: string;
}

function field(p: Partial<Payload>, key: keyof Payload, fallback: string): string {
  const v = p[key];
  return v === undefined || v === null || `${v}`.trim() === "" ? fallback : `${v}`;
}

const COPY = {
  fr: {
    title: "Un changement de date pour votre intervention",
    intro: (n: string) => `Bonjour ${n},`,
    apology: (type: string, old: string) =>
      `Nous devons vous demander un peu d'indulgence : pour des raisons d'organisation de notre côté, nous avons dû déplacer la date de votre ${type}${old ? `, initialement prévue le ${old}` : ""}. Nous en sommes sincèrement désolés.`,
    newDate: (next: string) =>
      `La nouvelle date retenue est le ${next}. Si elle ne vous convient pas, dites-le-nous simplement : nous trouverons ensemble le créneau qui vous arrange le mieux.`,
    available:
      "Nous restons pleinement mobilisés pour vous offrir une intervention à la hauteur de vos attentes, et nous vous remercions de votre compréhension.",
    close:
      "Pour toute question ou pour convenir d'une autre date, répondez simplement à cet email ou contactez-nous : nous sommes à votre écoute.\n\nBien à vous,\nL'équipe Axion-IA",
    cta: "Nous contacter",
  },
  en: {
    title: "A date change for your session",
    intro: (n: string) => `Hello ${n},`,
    apology: (type: string, old: string) =>
      `We must ask for a little understanding: for organisational reasons on our side, we had to move the date of your ${type}${old ? `, originally scheduled for ${old}` : ""}. We are sincerely sorry for this.`,
    newDate: (next: string) =>
      `The new date is ${next}. If it does not suit you, just let us know — we will find together the slot that works best for you.`,
    available:
      "We remain fully committed to delivering a session that meets your expectations, and we thank you for your understanding.",
    close:
      "For any question or to arrange another date, simply reply to this email or get in touch — we are here to help.\n\nWarm regards,\nThe Axion-IA team",
    cta: "Contact us",
  },
} as const;

export const bookingRescheduledByAdminSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const next = field(payload as Partial<Payload>, "newDate", "");
  const suffix = next ? ` — ${next}` : "";
  return locale === "fr"
    ? `Nouvelle date pour votre intervention${suffix} — Axion-IA`
    : `New date for your session${suffix} — Axion-IA`;
};

export function BookingRescheduledByAdminEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as Partial<Payload>;
  const t = COPY[locale];

  const contactName = field(p, "contactName", "");
  const interventionType = field(
    p,
    "interventionType",
    locale === "fr" ? "intervention" : "session",
  );
  const bookingDate = field(p, "bookingDate", "");
  const newDate = field(p, "newDate", locale === "fr" ? "une nouvelle date" : "a new date");
  const feedbackUrl = field(p, "feedbackUrl", `${SITE_URL}/contact`);

  const greeting = contactName ? t.intro(contactName) : locale === "fr" ? "Bonjour," : "Hello,";

  return (
    <EmailLayout
      preview={t.title}
      title={t.title}
      cta={{ label: t.cta, href: feedbackUrl }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{greeting}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.apology(interventionType, bookingDate)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.newDate(newDate)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.available}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, whiteSpace: "pre-line" }}>{t.close}</Text>
    </EmailLayout>
  );
}
