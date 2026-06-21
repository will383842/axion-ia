// Email — Nouvelle version du contrat (cycle de vie, signature DocuSeal).
//
// Étape positive : une version mise à jour du contrat a été préparée (motif
// optionnel). Le client est invité à la consulter et à la signer. CTA → lien
// DocuSeal. Aucune mention de paiement par carte/Stripe.

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
  /** Motif de la nouvelle version. Optionnel. */
  reason?: string;
}

function field(p: Partial<Payload>, key: keyof Payload, fallback: string): string {
  const v = p[key];
  return v === undefined || v === null || `${v}`.trim() === "" ? fallback : `${v}`;
}

const COPY = {
  fr: {
    title: "Une nouvelle version de votre contrat est disponible",
    intro: (n: string) => `Bonjour ${n},`,
    updated: (intervention: string) =>
      `Une nouvelle version de votre contrat${intervention ? ` pour ${intervention}` : ""} vient d'être préparée. Elle remplace la version précédente, qui n'est plus à signer.`,
    reason: (r: string) => `Motif de la mise à jour : ${r}.`,
    review:
      "Nous vous invitons à la consulter à tête reposée, puis à la signer en ligne en quelques clics via notre outil de signature électronique sécurisée, en cliquant sur le bouton ci-dessous.",
    close:
      "Si vous avez la moindre question sur ces changements, répondez simplement à cet email : nous y répondrons avec plaisir.\n\nÀ très bientôt,\nL'équipe Axion-IA",
    cta: "Consulter et signer",
  },
  en: {
    title: "A new version of your contract is available",
    intro: (n: string) => `Hello ${n},`,
    updated: (intervention: string) =>
      `A new version of your contract${intervention ? ` for ${intervention}` : ""} has just been prepared. It replaces the previous version, which no longer needs to be signed.`,
    reason: (r: string) => `Reason for the update: ${r}.`,
    review:
      "We invite you to review it at your convenience, then sign it online in a few clicks through our secure electronic signature tool, by clicking the button below.",
    close:
      "If you have any question about these changes, simply reply to this email — we'll be glad to answer.\n\nTalk soon,\nThe Axion-IA team",
    cta: "Review and sign",
  },
} as const;

export const contractVersionUpdatedSubject = (locale: Locale): string =>
  locale === "fr"
    ? "Nouvelle version de votre contrat à signer — Axion-IA"
    : "New version of your contract to sign — Axion-IA";

export function ContractVersionUpdatedEmail({
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
  const reason = field(p, "reason", "");
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
      <Text style={emailStyles.paragraphStyle}>{t.updated(interventionType)}</Text>
      {reason ? <Text style={emailStyles.paragraphStyle}>{t.reason(reason)}</Text> : null}
      <Text style={emailStyles.paragraphStyle}>{t.review}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, whiteSpace: "pre-line" }}>{t.close}</Text>
    </EmailLayout>
  );
}
