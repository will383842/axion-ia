// Email — Rappel doux de signature de contrat (cycle de vie, signature DocuSeal).
//
// Relance bienveillante : le contrat attend toujours la signature du client.
// Ton doux, le lien reste actif, aide proposée en cas de difficulté. CTA →
// lien DocuSeal. Aucune mention de paiement par carte/Stripe.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";

interface Payload {
  contactName: string;
  /** Intitulé de la prestation concernée. Ex. « Formation IA — 2 jours ». */
  interventionType?: string;
  /** Lien de signature DocuSeal. Défaut : page contact. */
  signUrl?: string;
}

function field(p: Partial<Payload>, key: keyof Payload, fallback: string): string {
  const v = p[key];
  return v === undefined || v === null || `${v}`.trim() === "" ? fallback : `${v}`;
}

const COPY = {
  fr: {
    title: "Votre contrat attend votre signature",
    intro: (n: string) => `Bonjour ${n},`,
    reminder: (intervention: string) =>
      `Un petit rappel en toute simplicité : votre contrat${intervention ? ` pour ${intervention}` : ""} attend encore votre signature. Il s'agit sans doute d'un simple oubli dans un emploi du temps chargé.`,
    active:
      "Le lien de signature reste actif : il vous suffit de cliquer sur le bouton ci-dessous pour consulter et signer votre contrat en quelques clics, en toute sécurité.",
    help: "Si vous rencontrez la moindre difficulté technique, ou si une question vous retient avant de signer, dites-le-nous : nous serons ravis de vous aider.",
    close:
      "Répondez simplement à cet email pour toute question : nous sommes à votre écoute.\n\nÀ très bientôt,\nL'équipe Axion-IA",
    cta: "Signer mon contrat",
  },
  en: {
    title: "Your contract is waiting for your signature",
    intro: (n: string) => `Hello ${n},`,
    reminder: (intervention: string) =>
      `A gentle reminder: your contract${intervention ? ` for ${intervention}` : ""} is still waiting for your signature. It's most likely a simple oversight in a busy schedule.`,
    active:
      "The signing link is still active: just click the button below to review and sign your contract in a few clicks, securely.",
    help: "If you run into any technical difficulty, or if a question is holding you back before signing, just let us know — we'll be glad to help.",
    close:
      "Simply reply to this email with any question — we're here to help.\n\nTalk soon,\nThe Axion-IA team",
    cta: "Sign my contract",
  },
} as const;

export const contractReminderSubject = (locale: Locale): string =>
  locale === "fr"
    ? "Rappel : votre contrat attend votre signature — Axion-IA"
    : "Reminder: your contract is waiting for your signature — Axion-IA";

export function ContractReminderEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as Partial<Payload>;
  const t = COPY[locale];

  const contactName = field(p, "contactName", "");
  const interventionType = field(p, "interventionType", "");
  const signUrl = field(p, "signUrl", `${SITE_URL}/contact`);

  const greeting = contactName ? t.intro(contactName) : locale === "fr" ? "Bonjour," : "Hello,";

  return (
    <EmailLayout
      preview={t.title}
      title={t.title}
      cta={{ label: t.cta, href: signUrl }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{greeting}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.reminder(interventionType)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.active}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.help}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, whiteSpace: "pre-line" }}>{t.close}</Text>
    </EmailLayout>
  );
}
