// Email — relance douce autour d'un devis envoyé (RELATION-CLIENT, zéro pression).
//
// Email de courtoisie : le devis a été envoyé il y a quelques jours et reste
// valable. On rappelle simplement sa disponibilité, on se rend disponible pour
// toute question, et on n'exerce AUCUNE pression. Aucune mention de paiement /
// carte / Stripe — uniquement une invitation chaleureuse à consulter le devis.
// Payload ci-dessous = forme attendue (fallbacks robustes via `field()`).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";

interface Payload {
  contactName: string;
  /** N° du devis concerné. Ex. « D-2026-014 ». Optionnel. */
  quoteNumber?: string;
  /** Date de validité du devis (formatée). Ex. « 30/06/2026 ». Optionnelle. */
  validUntil?: string;
  /** Lien pour consulter le devis. Défaut : page contact. */
  quoteUrl?: string;
}

function field(p: Partial<Payload>, key: keyof Payload, fallback: string): string {
  const v = p[key];
  return v === undefined || v === null || `${v}`.trim() === "" ? fallback : `${v}`;
}

const COPY = {
  fr: {
    title: "Votre devis est toujours valable",
    intro: (n: string) => `Bonjour ${n},`,
    sent: (q: string) =>
      `Nous vous avons adressé votre devis ${q} il y a quelques jours et nous voulions simplement nous assurer qu'il vous est bien parvenu.`,
    validity: (d: string) =>
      d
        ? `Bonne nouvelle : il reste valable jusqu'au ${d}. Vous avez donc tout le temps d'y réfléchir, sans la moindre pression de notre part.`
        : `Il reste valable, vous avez donc tout le temps d'y réfléchir, sans la moindre pression de notre part.`,
    available:
      "Si une question vous traverse l'esprit — sur le contenu, le périmètre, le calendrier ou les modalités — nous serons ravis d'y répondre. N'hésitez pas à répondre directement à cet email : nous sommes à votre écoute.",
    close: "Au plaisir d'échanger avec vous,\nL'équipe Axion-IA",
    cta: "Consulter mon devis",
  },
  en: {
    title: "Your quote is still valid",
    intro: (n: string) => `Hello ${n},`,
    sent: (q: string) =>
      `We sent you your quote ${q} a few days ago and simply wanted to make sure it reached you safely.`,
    validity: (d: string) =>
      d
        ? `Good news: it remains valid until ${d}. So you have all the time you need to consider it, with absolutely no pressure from us.`
        : `It is still valid, so you have all the time you need to consider it, with absolutely no pressure from us.`,
    available:
      "Should any question come to mind — about the content, scope, timing or terms — we would be delighted to help. Feel free to reply directly to this email: we are here for you.",
    close: "Looking forward to speaking with you,\nThe Axion-IA team",
    cta: "View my quote",
  },
} as const;

export const quoteReminderSubject = (locale: Locale, payload: Record<string, unknown>): string => {
  const q = field(payload as Partial<Payload>, "quoteNumber", "");
  const suffix = q ? ` ${q}` : "";
  return locale === "fr"
    ? `Votre devis${suffix} est toujours valable — Axion-IA`
    : `Your quote${suffix} is still valid — Axion-IA`;
};

export function QuoteReminderEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as Partial<Payload>;
  const t = COPY[locale];

  const contactName = field(p, "contactName", "");
  const quoteNumber = field(p, "quoteNumber", locale === "fr" ? "concerné" : "concerned");
  const validUntil = field(p, "validUntil", "");
  const quoteUrl = field(p, "quoteUrl", `${SITE_URL}/contact`);

  const greeting = contactName ? t.intro(contactName) : locale === "fr" ? "Bonjour," : "Hello,";

  return (
    <EmailLayout
      preview={t.title}
      title={t.title}
      cta={{ label: t.cta, href: quoteUrl }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{greeting}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.sent(quoteNumber)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.validity(validUntil)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.available}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, whiteSpace: "pre-line" }}>{t.close}</Text>
    </EmailLayout>
  );
}
