// Email — Remerciement après l'intervention (RELATION-CLIENT, chaleureux).
//
// « Merci de votre confiance » après l'intervention, invite à partager un retour.
// CTA doux « Partager mon retour » → feedbackUrl. AUCUNE mention de paiement /
// carte / Stripe.
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
  /** Date de l'intervention (formatée). Ex. « 21/05/2026 ». */
  bookingDate?: string;
  /** URL pour partager un retour. Défaut : page contact. */
  feedbackUrl?: string;
}

function field(p: Partial<Payload>, key: keyof Payload, fallback: string): string {
  const v = p[key];
  return v === undefined || v === null || `${v}`.trim() === "" ? fallback : `${v}`;
}

const COPY = {
  fr: {
    title: "Merci de votre confiance",
    intro: (n: string) => `Bonjour ${n},`,
    thanks: (type: string, date: string) =>
      `Un grand merci d'avoir choisi Axion-IA pour votre ${type}${date ? ` du ${date}` : ""}. Ce fut un réel plaisir de vous accompagner, et nous espérons que cette intervention vous sera précieuse au quotidien.`,
    confidence:
      "Votre confiance compte beaucoup pour nous. Nous mettons tout en œuvre pour que chaque intervention soit utile, concrète et à la hauteur de vos attentes.",
    feedback:
      "Votre ressenti nous aide à progresser et à mieux accompagner ceux qui nous rejoindront après vous. Si vous avez quelques minutes, nous serions ravis de recevoir votre retour — qu'il soit enthousiaste ou plein de suggestions.",
    close:
      "Et bien sûr, si nous pouvons vous être utiles à l'avenir, n'hésitez pas : nous restons à votre disposition.\n\nAvec toute notre gratitude,\nL'équipe Axion-IA",
    cta: "Partager mon retour",
  },
  en: {
    title: "Thank you for your trust",
    intro: (n: string) => `Hello ${n},`,
    thanks: (type: string, date: string) =>
      `A big thank you for choosing Axion-IA for your ${type}${date ? ` on ${date}` : ""}. It was a real pleasure to support you, and we hope this session will prove valuable in your day-to-day work.`,
    confidence:
      "Your trust means a great deal to us. We do everything we can to make every session useful, practical and worthy of your expectations.",
    feedback:
      "Your feedback helps us improve and better support those who join us after you. If you have a few minutes, we would be delighted to hear from you — whether your thoughts are enthusiastic or full of suggestions.",
    close:
      "And of course, if we can be of help to you in the future, please don't hesitate: we remain at your disposal.\n\nWith all our gratitude,\nThe Axion-IA team",
    cta: "Share my feedback",
  },
} as const;

export const bookingCompletedThanksSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const name = field(payload as Partial<Payload>, "contactName", "");
  const suffix = name ? ` ${name}` : "";
  return locale === "fr"
    ? `Merci${suffix} pour votre confiance — Axion-IA`
    : `Thank you${suffix} for your trust — Axion-IA`;
};

export function BookingCompletedThanksEmail({
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
      <Text style={emailStyles.paragraphStyle}>{t.thanks(interventionType, bookingDate)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.confidence}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.feedback}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, whiteSpace: "pre-line" }}>{t.close}</Text>
    </EmailLayout>
  );
}
