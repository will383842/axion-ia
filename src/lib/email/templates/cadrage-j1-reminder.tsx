// Email — Rappel J-1 du call de cadrage / réunion de découverte.
//
// Ton chaleureux et enthousiaste : ce n'est PAS une relance, c'est un rappel
// avant un échange de collaboration. On invite la personne à préparer ses
// questions / le contexte business pour tirer le meilleur du call. Aucun
// paiement (pas de carte/Stripe) — c'est un rendez-vous de découverte.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";

interface Payload {
  contactName: string;
  /** Date et heure du call (formatées). Ex. « demain à 14 h 00 ». */
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
    title: "Votre call de cadrage, c'est demain",
    intro: (n: string) => `Bonjour ${n},`,
    reminder: (date: string, duration: string) =>
      `Petit rappel tout simple : votre call de cadrage avec l'équipe Axion-IA est prévu ${date}${duration ? ` (environ ${duration} minutes)` : ""}. On a hâte d'échanger avec vous !`,
    purpose:
      "Ce moment, c'est avant tout le vôtre : l'occasion de nous parler de votre activité, de vos objectifs et de ce que vous aimeriez accomplir avec l'IA. Plus on comprend votre contexte, plus nos recommandations seront pertinentes et concrètes.",
    prepare:
      "Pour en tirer le maximum, vous pouvez prendre un instant pour noter vos questions, les irritants du quotidien que vous aimeriez régler, ou les processus que vous rêvez d'alléger. Rien d'obligatoire, juste de quoi nourrir l'échange — on s'occupe du reste.",
    practical:
      "Le jour J, il vous suffira de cliquer sur le bouton ci-dessous pour nous rejoindre, depuis votre ordinateur ou votre téléphone. Si un imprévu vous empêche d'être là, répondez simplement à cet email et on trouvera un autre créneau ensemble.",
    close: "À tout de suite,\nL'équipe Axion-IA",
    cta: "Rejoindre le call",
  },
  en: {
    title: "Your kickoff call is tomorrow",
    intro: (n: string) => `Hello ${n},`,
    reminder: (date: string, duration: string) =>
      `Just a friendly reminder: your kickoff call with the Axion-IA team is scheduled for ${date}${duration ? ` (about ${duration} minutes)` : ""}. We're really looking forward to it!`,
    purpose:
      "This time is yours above all: a chance to tell us about your business, your goals, and what you'd love to achieve with AI. The more we understand your context, the more relevant and practical our recommendations will be.",
    prepare:
      "To get the most out of it, feel free to jot down your questions, the day-to-day frustrations you'd like to solve, or the processes you dream of streamlining. Nothing mandatory — just enough to fuel the conversation. We'll handle the rest.",
    practical:
      "On the day, simply click the button below to join us, from your computer or your phone. If anything comes up and you can't make it, just reply to this email and we'll find another slot together.",
    close: "See you soon,\nThe Axion-IA team",
    cta: "Join the call",
  },
} as const;

export const cadrageJ1ReminderSubject = (locale: Locale, _payload: Record<string, unknown>): string =>
  locale === "fr"
    ? "Votre call de cadrage, c'est demain — Axion-IA"
    : "Your kickoff call is tomorrow — Axion-IA";

export function CadrageJ1ReminderEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as Partial<Payload>;
  const t = COPY[locale];

  const contactName = field(p, "contactName", "");
  const meetingDate = field(p, "meetingDate", locale === "fr" ? "demain" : "tomorrow");
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
      <Text style={emailStyles.paragraphStyle}>{t.purpose}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.prepare}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.practical}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, whiteSpace: "pre-line" }}>{t.close}</Text>
    </EmailLayout>
  );
}
