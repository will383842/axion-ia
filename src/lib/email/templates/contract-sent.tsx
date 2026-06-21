// Email — Contrat prêt à signer (cycle de vie du contrat, signature DocuSeal).
//
// Étape positive de la collaboration : le contrat est généré et attend la
// signature électronique du client. CTA → lien DocuSeal. Aucune mention de
// paiement par carte/Stripe.

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
    title: "Votre contrat est prêt à signer",
    intro: (n: string) => `Bonjour ${n},`,
    body: (intervention: string) =>
      `Bonne nouvelle : votre contrat${intervention ? ` pour ${intervention}` : ""} est prêt. Il ne reste plus qu'à le signer pour officialiser notre collaboration.`,
    secure:
      "La signature se fait en ligne, en quelques clics, via notre outil de signature électronique sécurisée. Aucune impression ni renvoi papier nécessaire.",
    next: "Cliquez simplement sur le bouton ci-dessous pour consulter et signer votre contrat.",
    close:
      "Pour toute question avant de signer, répondez directement à cet email : nous sommes à votre écoute.\n\nÀ très bientôt,\nL'équipe Axion-IA",
    cta: "Signer mon contrat",
  },
  en: {
    title: "Your contract is ready to sign",
    intro: (n: string) => `Hello ${n},`,
    body: (intervention: string) =>
      `Good news: your contract${intervention ? ` for ${intervention}` : ""} is ready. All that's left is your signature to make our collaboration official.`,
    secure:
      "Signing is done online, in just a few clicks, through our secure electronic signature tool. No printing or paper return required.",
    next: "Simply click the button below to review and sign your contract.",
    close:
      "If you have any question before signing, just reply to this email — we're here to help.\n\nTalk soon,\nThe Axion-IA team",
    cta: "Sign my contract",
  },
} as const;

export const contractSentSubject = (locale: Locale): string =>
  locale === "fr"
    ? "Votre contrat est prêt à signer — Axion-IA"
    : "Your contract is ready to sign — Axion-IA";

export function ContractSentEmail({
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
      <Text style={emailStyles.paragraphStyle}>{t.body(interventionType)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.secure}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.next}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, whiteSpace: "pre-line" }}>{t.close}</Text>
    </EmailLayout>
  );
}
