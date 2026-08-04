// Email — Contrat signé (cycle de vie du contrat, signature DocuSeal).
//
// Étape de remerciement : le contrat est signé par les deux parties. Ton
// chaleureux, annonce du PDF final et des prochaines étapes positives. Pas de
// CTA dur (lien doux vers contact). Aucune mention de paiement par carte/Stripe.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";

interface Payload {
  contactName: string;
  /** Intitulé de la prestation concernée. Ex. « Formation IA — 2 jours ». */
  interventionType?: string;
  /** Lien de contact (CTA doux). Défaut : page contact. */
  signUrl?: string;
}

function field(p: Partial<Payload>, key: keyof Payload, fallback: string): string {
  const v = p[key];
  return v === undefined || v === null || `${v}`.trim() === "" ? fallback : `${v}`;
}

const COPY = {
  fr: {
    title: "Merci — votre contrat est signé",
    intro: (n: string) => `Bonjour ${n},`,
    thanks: (intervention: string) =>
      `Un grand merci ! Votre contrat${intervention ? ` pour ${intervention}` : ""} est désormais signé par les deux parties. Nous sommes ravis de démarrer cette collaboration avec vous.`,
    pdf: "Vous recevrez sous peu, par email séparé, le PDF final du contrat signé pour vos archives.",
    next: "De notre côté, nous préparons dès maintenant les prochaines étapes. Nous reviendrons vers vous très vite avec les détails de la suite.",
    close:
      "Pour toute question, n'hésitez jamais à nous écrire : nous restons à votre entière disposition.\n\nÀ très bientôt,\nL'équipe Axion-IA",
    cta: "Nous contacter",
  },
  en: {
    title: "Thank you — your contract is signed",
    intro: (n: string) => `Hello ${n},`,
    thanks: (intervention: string) =>
      `Thank you so much! Your contract${intervention ? ` for ${intervention}` : ""} is now signed by both parties. We're delighted to begin this collaboration with you.`,
    pdf: "You'll shortly receive, in a separate email, the final PDF of the signed contract for your records.",
    next: "On our side, we're already preparing the next steps. We'll get back to you very soon with what comes next.",
    close:
      "If you have any question, please never hesitate to write to us — we remain fully at your disposal.\n\nTalk soon,\nThe Axion-IA team",
    cta: "Contact us",
  },
} as const;

export const contractSignedSubject = (locale: Locale): string =>
  locale === "fr"
    ? "Votre contrat est signé — merci ! — Axion-IA"
    : "Your contract is signed — thank you! — Axion-IA";

export function ContractSignedEmail({
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
  const contactUrl = field(p, "signUrl", `${SITE_URL}/contact`);

  const greeting = contactName ? t.intro(contactName) : locale === "fr" ? "Bonjour," : "Hello,";

  return (
    <EmailLayout
      preview={t.title}
      title={t.title}
      cta={{ label: t.cta, href: contactUrl }}
      locale={locale}
      trust
    >
      <Text style={emailStyles.paragraphStyle}>{greeting}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.thanks(interventionType)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.pdf}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.next}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, whiteSpace: "pre-line" }}>{t.close}</Text>
    </EmailLayout>
  );
}
