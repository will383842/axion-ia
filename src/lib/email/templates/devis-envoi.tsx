// Email — envoi MANUEL d'un devis par l'admin (Hub facturation), PDF joint.
//
// Déclenché exclusivement par un clic admin — JAMAIS par un cron : soit à
// l'envoi initial (sendDevisAction, bouton « Envoyer au client »), soit au
// renvoi manuel (envoyerDevisEmailAction). Le PDF du devis est attaché par le
// worker (clé R2 dans EmailJobData.attachments). Si `signatureUrl` est fourni
// (embed_src DocuSeal du client), un CTA « Signer en ligne » est ajouté. Le
// message personnalisé de l'admin (multi-lignes) est affiché tel quel. Ton :
// courtois, zéro pression.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  clientNom: string;
  /** N° du devis. Ex. « AXI-DEV-2026-014 ». */
  numero: string;
  /** Montant formaté. Ex. « 2 450,00 € HT ». Optionnel. */
  montantLabel?: string;
  /** Date de validité formatée. Ex. « 11/08/2026 ». Optionnelle. */
  dateValiditeLabel?: string;
  /** Message libre de l'admin (multi-lignes, affiché tel quel). Optionnel. */
  messagePersonnalise?: string;
  /**
   * Lien de signature en ligne (embed_src DocuSeal du client). Si présent,
   * un CTA « Signer le devis en ligne » est affiché. Optionnel — sans DocuSeal
   * configuré, le devis reste signable par retour du PDF « bon pour accord ».
   */
  signatureUrl?: string;
}

function field(p: Partial<Payload>, key: keyof Payload, fallback: string): string {
  const v = p[key];
  return v === undefined || v === null || `${v}`.trim() === "" ? fallback : `${v}`;
}

const COPY = {
  fr: {
    title: "Votre devis Axion-IA",
    intro: (n: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
    body: (num: string, montant: string) =>
      `Veuillez trouver ci-joint votre devis ${num}${montant ? ` d'un montant de ${montant}` : ""}, au format PDF.`,
    validity: (d: string) => (d ? `Il est valable jusqu'au ${d}.` : ""),
    preview: (montant: string, validite: string) =>
      [montant ? `${montant}` : "", validite ? `valable jusqu'au ${validite}` : "", "PDF joint"]
        .filter(Boolean)
        .join(" — ") + ".",
    attachment: "Le document est joint à cet email au format PDF.",
    sign: "Vous pouvez signer votre « bon pour accord » en ligne, en un clic, via le bouton ci-dessous.",
    signCta: "Signer le devis en ligne",
    questions:
      "Pour toute question sur le contenu, le périmètre ou les modalités, répondez simplement à cet email : nous sommes à votre écoute.",
    close: "Bien cordialement,\nL'équipe Axion-IA",
  },
  en: {
    title: "Your Axion-IA quote",
    intro: (n: string) => (n ? `Hello ${n},` : "Hello,"),
    body: (num: string, montant: string) =>
      `Please find attached your quote ${num}${montant ? ` for ${montant}` : ""}, in PDF format.`,
    validity: (d: string) => (d ? `It is valid until ${d}.` : ""),
    preview: (montant: string, validite: string) =>
      [montant ? `${montant}` : "", validite ? `valid until ${validite}` : "", "PDF attached"]
        .filter(Boolean)
        .join(" — ") + ".",
    attachment: "The document is attached to this email in PDF format.",
    sign: "You can sign your approval online, in one click, using the button below.",
    signCta: "Sign the quote online",
    questions:
      "For any question about the content, scope or terms, simply reply to this email: we are here for you.",
    close: "Best regards,\nThe Axion-IA team",
  },
} as const;

export const devisEnvoiSubject = (locale: Locale, payload: Record<string, unknown>): string => {
  const num = field(payload as Partial<Payload>, "numero", "");
  return locale === "fr" ? `Votre devis ${num}` : `Your quote ${num}`;
};

export function DevisEnvoiEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as Partial<Payload>;
  const t = COPY[locale];
  const message = field(p, "messagePersonnalise", "");
  const signatureUrl = field(p, "signatureUrl", "");

  return (
    <EmailLayout
      famille="B"
      locale={locale}
      title={t.title}
      /* Le pré-en-tête reprenait l'objet mot pour mot. Il porte désormais le
         montant et la date de validité — ce qu'on cherche avant d'ouvrir. */
      preview={t.preview(field(p, "montantLabel", ""), field(p, "dateValiditeLabel", ""))}
      {...(signatureUrl !== "" ? { cta: { label: t.signCta, href: signatureUrl } } : {})}
    >
      <Text style={emailStyles.paragraphStyle}>{t.intro(field(p, "clientNom", ""))}</Text>
      {message !== "" &&
        message.split("\n").map((line, i) => (
          <Text key={i} style={emailStyles.paragraphStyle}>
            {line}
          </Text>
        ))}
      <Text style={emailStyles.paragraphStyle}>
        {t.body(field(p, "numero", ""), field(p, "montantLabel", ""))}{" "}
        {t.validity(field(p, "dateValiditeLabel", ""))}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.attachment}</Text>
      {signatureUrl !== "" && <Text style={emailStyles.paragraphStyle}>{t.sign}</Text>}
      <Text style={emailStyles.paragraphStyle}>{t.questions}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {t.close.split("\n").map((line, i) => (
          <span key={i}>
            {line}
            <br />
          </span>
        ))}
      </Text>
    </EmailLayout>
  );
}
