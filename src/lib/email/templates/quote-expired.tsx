// Email — devis arrivé à sa date de validité (RELATION-CLIENT, ton ouvert).
//
// Email positif et sans pression : le devis a simplement atteint sa date de
// validité. On en informe avec le sourire et on propose, avec plaisir, de le
// réémettre ou d'en reparler — la porte reste grande ouverte. Aucune mention de
// paiement / carte / Stripe. Payload ci-dessous = forme attendue (fallbacks).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";

interface Payload {
  contactName: string;
  /** N° du devis concerné. Ex. « D-2026-014 ». Optionnel. */
  quoteNumber?: string;
  /** Lien pour demander un nouveau devis. Défaut : page contact. */
  quoteUrl?: string;
}

function field(p: Partial<Payload>, key: keyof Payload, fallback: string): string {
  const v = p[key];
  return v === undefined || v === null || `${v}`.trim() === "" ? fallback : `${v}`;
}

const COPY = {
  fr: {
    title: "Votre devis a atteint sa date de validité",
    intro: (n: string) => `Bonjour ${n},`,
    expired: (q: string) =>
      `Votre devis ${q} vient d'atteindre sa date de validité. Rien d'alarmant : c'est une simple formalité, et votre projet nous tient toujours autant à cœur.`,
    offer:
      "Si vous souhaitez aller plus loin, nous serons ravis de vous réémettre un devis à jour en quelques minutes — en tenant compte de l'évolution éventuelle de vos besoins. Et si vous préférez d'abord en discuter, c'est avec grand plaisir.",
    available:
      "Il vous suffit de cliquer sur le bouton ci-dessous ou de répondre directement à cet email : nous reprenons le fil avec vous quand vous le voulez, sans aucune pression.",
    close: "Au plaisir de poursuivre l'échange,\nL'équipe Axion-IA",
    cta: "Demander un nouveau devis",
  },
  en: {
    title: "Your quote has reached its validity date",
    intro: (n: string) => `Hello ${n},`,
    expired: (q: string) =>
      `Your quote ${q} has just reached its validity date. Nothing to worry about: it is a simple formality, and we still care just as much about your project.`,
    offer:
      "If you would like to move forward, we will be delighted to send you an updated quote in just a few minutes — taking into account any changes in your needs. And if you would rather talk it through first, we would love that too.",
    available:
      "Simply click the button below or reply directly to this email: we will pick things up with you whenever you wish, with no pressure at all.",
    close: "Looking forward to continuing the conversation,\nThe Axion-IA team",
    cta: "Request a new quote",
  },
} as const;

export const quoteExpiredSubject = (locale: Locale, payload: Record<string, unknown>): string => {
  const q = field(payload as Partial<Payload>, "quoteNumber", "");
  const suffix = q ? ` ${q}` : "";
  return locale === "fr"
    ? `Votre devis${suffix} a atteint sa date de validité — Axion-IA`
    : `Your quote${suffix} has reached its validity date — Axion-IA`;
};

export function QuoteExpiredEmail({
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
      <Text style={emailStyles.paragraphStyle}>{t.expired(quoteNumber)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.offer}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.available}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, whiteSpace: "pre-line" }}>{t.close}</Text>
    </EmailLayout>
  );
}
