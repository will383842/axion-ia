// Email — envoi MANUEL d'un devis par l'admin (Hub facturation), PDF joint.
//
// Déclenché exclusivement par un clic admin — JAMAIS par un cron : soit à
// l'envoi initial (sendDevisAction, bouton « Envoyer au client »), soit au
// renvoi manuel (envoyerDevisEmailAction). Le PDF du devis est attaché par le
// worker (clé R2 dans EmailJobData.attachments). Si `signatureUrl` est fourni
// (lien de signature MAISON `/portail/signer/<jeton>`, depuis le 30/07/2026), un CTA « Signer en ligne » est ajouté. Le
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
   * Lien de signature en ligne MAISON (`/portail/signer/<jeton>`, jeton porteur : ne
   * jamais le journaliser ni l'envoyer à Sentry). Si présent, un CTA « Signer le devis
   * en ligne » est affiché. Optionnel — sans lien, le devis reste signable par retour
   * du PDF « bon pour accord ». DocuSeal n'émet plus rien depuis le 30/07/2026.
   */
  signatureUrl?: string;
  /** Devis à formules : nombre de formules proposées (2 = « 2 formules au choix »). */
  nbFormules?: number;
  /** Intitulés des formules, tels que sur le PDF. */
  libellesFormules?: string[];
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
    formules: (n: number, l: string) =>
      `Ce devis vous propose ${n} formules au choix${l ? ` : ${l}` : ""}. Elles figurent côte à côte dans le document joint.`,
    sign: (formules: boolean) =>
      `Pour signer, ouvrez le lien ci-dessous, ${formules ? "choisissez votre formule, " : ""}cochez l'acceptation des conditions générales de vente, puis signez. Le contrat est formé lorsque Axion-IA a contresigné (CGV art. 6.2).`,
    signCta: "Signer le devis en ligne",
    questions:
      "Pour toute question sur le contenu, le périmètre ou les modalités, répondez simplement à cet email : nous sommes à votre écoute.",
    close: "Bien cordialement,\nWilliams",
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
    formules: (n: number, l: string) =>
      `This quote offers ${n} options to choose from${l ? `: ${l}` : ""}. They are shown side by side in the attached document.`,
    sign: (formules: boolean) =>
      `To sign, open the link below, ${formules ? "choose your option, " : ""}tick the acceptance of the general terms of sale, then sign. The contract is formed once Axion-IA has countersigned (T&C art. 6.2).`,
    signCta: "Sign the quote online",
    questions:
      "For any question about the content, scope or terms, simply reply to this email: we are here for you.",
    close: "Best regards,\nWilliams",
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
  const nbFormules = typeof p.nbFormules === "number" && p.nbFormules >= 2 ? p.nbFormules : 0;
  const libellesFormules = Array.isArray(p.libellesFormules)
    ? p.libellesFormules.filter((x): x is string => typeof x === "string").join(" / ")
    : "";

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
      {nbFormules > 0 && (
        <Text style={emailStyles.paragraphStyle}>{t.formules(nbFormules, libellesFormules)}</Text>
      )}
      <Text style={emailStyles.paragraphStyle}>{t.attachment}</Text>
      {signatureUrl !== "" && (
        <Text style={emailStyles.paragraphStyle}>{t.sign(nbFormules > 0)}</Text>
      )}
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
