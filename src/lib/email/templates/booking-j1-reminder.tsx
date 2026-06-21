// Email — Rappel J-1 avant l'intervention (RELATION-CLIENT, ton positif).
//
// « Votre intervention démarre demain » : rappel pratique chaleureux, l'équipe
// sera présente, invite à préparer si besoin. AUCUNE mention de paiement /
// carte / Stripe. Pas de CTA dur (« Nous contacter »).
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
  /** URL pour nous joindre / poser une question. Défaut : page contact. */
  feedbackUrl?: string;
}

function field(p: Partial<Payload>, key: keyof Payload, fallback: string): string {
  const v = p[key];
  return v === undefined || v === null || `${v}`.trim() === "" ? fallback : `${v}`;
}

const COPY = {
  fr: {
    title: "C'est pour demain !",
    intro: (n: string) => `Bonjour ${n},`,
    tomorrow: (type: string, date: string) =>
      `Petit mot pour vous le rappeler avec plaisir : votre ${type} démarre demain${date ? `, le ${date}` : ""}. Nous avons hâte d'y être.`,
    team: "Notre équipe sera bien présente et prête à vous accompagner tout au long de l'intervention. Vous n'avez rien de particulier à anticiper : nous nous occupons de tout.",
    prepare:
      "Si vous le souhaitez, vous pouvez réunir quelques exemples concrets de votre quotidien (cas d'usage, questions, irritants) : c'est toujours un excellent point de départ. Mais ce n'est en rien obligatoire.",
    close:
      "Une question de dernière minute ou un imprévu ? Répondez simplement à cet email ou contactez-nous : nous sommes là.\n\nÀ très vite,\nL'équipe Axion-IA",
    cta: "Nous contacter",
  },
  en: {
    title: "It's tomorrow!",
    intro: (n: string) => `Hello ${n},`,
    tomorrow: (type: string, date: string) =>
      `Just a quick, happy reminder: your ${type} starts tomorrow${date ? `, on ${date}` : ""}. We can't wait.`,
    team: "Our team will be there, ready to support you throughout the session. There's nothing in particular to prepare — we take care of everything.",
    prepare:
      "If you'd like, you can gather a few concrete examples from your day-to-day (use cases, questions, pain points): it's always a great starting point. But it's by no means required.",
    close:
      "A last-minute question or something unexpected? Simply reply to this email or get in touch — we're here.\n\nSee you very soon,\nThe Axion-IA team",
    cta: "Contact us",
  },
} as const;

export const bookingJ1ReminderSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const type = field(payload as Partial<Payload>, "interventionType", "");
  const suffix = type ? ` — ${type}` : "";
  return locale === "fr"
    ? `Votre intervention, c'est demain${suffix} — Axion-IA`
    : `Your session is tomorrow${suffix} — Axion-IA`;
};

export function BookingJ1ReminderEmail({
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
      <Text style={emailStyles.paragraphStyle}>{t.tomorrow(interventionType, bookingDate)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.team}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.prepare}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, whiteSpace: "pre-line" }}>{t.close}</Text>
    </EmailLayout>
  );
}
