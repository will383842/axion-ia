// Email — Rappel H-2 du call de cadrage / réunion de découverte.
//
// Ton léger et chaleureux : le call commence dans 2 heures, on rappelle juste
// le lien visio pour que tout soit fluide. Pas une relance — un coup de pouce
// amical avant un échange de collaboration. Aucun paiement (pas de carte/Stripe).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";

interface Payload {
  contactName: string;
  /** Date et heure du call (formatées). Ex. « aujourd'hui à 14 h 00 ». */
  meetingDate?: string;
  /** Lien de visioconférence. Défaut : page contact. */
  visioUrl?: string;
  /** Durée prévue, en minutes. Optionnelle. Ex. « 30 ». */
  durationMin?: string | number;
}

function field(p: Partial<Payload>, key: keyof Payload, fallback: string): string {
  const v = p[key];
  return v === undefined || v === null || `${v}`.trim() === "" ? fallback : `${v}`;
}

const COPY = {
  fr: {
    title: "C'est dans 2 heures !",
    intro: (n: string) => `Bonjour ${n},`,
    reminder: (date: string, duration: string) =>
      `On y est presque : votre call de cadrage avec l'équipe Axion-IA commence dans environ 2 heures${date ? ` (${date})` : ""}${duration ? `, pour ${duration} minutes` : ""}. On se réjouit de faire votre connaissance !`,
    link: "Pour nous rejoindre, rien de plus simple : cliquez sur le bouton ci-dessous le moment venu, depuis votre ordinateur ou votre téléphone. Gardez ce lien sous la main, il reste valable jusqu'au début de l'échange.",
    relax:
      "Aucune préparation particulière n'est nécessaire : venez comme vous êtes, avec vos questions et votre contexte en tête. On s'occupe de rendre ce moment utile et agréable.",
    practical:
      "Un imprévu de dernière minute ? Pas de souci : répondez simplement à cet email et on reprogrammera ensemble en toute simplicité.",
    close: "À tout de suite,\nL'équipe Axion-IA",
    cta: "Rejoindre le call",
  },
  en: {
    title: "It's in 2 hours!",
    intro: (n: string) => `Hello ${n},`,
    reminder: (date: string, duration: string) =>
      `Almost there: your kickoff call with the Axion-IA team starts in about 2 hours${date ? ` (${date})` : ""}${duration ? `, for ${duration} minutes` : ""}. We can't wait to meet you!`,
    link: "Joining is easy: just click the button below when the time comes, from your computer or your phone. Keep this link handy — it stays valid right up to the start of the call.",
    relax:
      "No special preparation needed: come as you are, with your questions and your context in mind. We'll make sure this is a useful and enjoyable moment.",
    practical:
      "Something came up at the last minute? No worries: simply reply to this email and we'll reschedule together, no fuss.",
    close: "See you soon,\nThe Axion-IA team",
    cta: "Join the call",
  },
} as const;

export const cadrageH2ReminderSubject = (locale: Locale, _payload: Record<string, unknown>): string =>
  locale === "fr"
    ? "Votre call commence dans 2 heures — Axion-IA"
    : "Your call starts in 2 hours — Axion-IA";

export function CadrageH2ReminderEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as Partial<Payload>;
  const t = COPY[locale];

  const contactName = field(p, "contactName", "");
  const meetingDate = field(p, "meetingDate", "");
  const visioUrl = field(p, "visioUrl", `${SITE_URL}/contact`);
  const durationMin = field(p, "durationMin", "");

  const greeting = contactName ? t.intro(contactName) : locale === "fr" ? "Bonjour," : "Hello,";

  return (
    <EmailLayout
      preview={t.title}
      title={t.title}
      cta={{ label: t.cta, href: visioUrl }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{greeting}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.reminder(meetingDate, durationMin)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.link}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.relax}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.practical}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, whiteSpace: "pre-line" }}>{t.close}</Text>
    </EmailLayout>
  );
}
