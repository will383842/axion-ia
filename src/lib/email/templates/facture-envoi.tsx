// Email — envoi MANUEL d'une facture (ou d'un avoir) par l'admin (Hub
// facturation), PDF joint.
//
// Déclenché exclusivement par un clic admin (envoyerFactureEmailAction) —
// JAMAIS par un cron (règle produit : relances et envois 100 % manuels).
// Le PDF est attaché par le worker (clé R2 dans EmailJobData.attachments).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  clientNom: string;
  /** N° de la facture (ou de l'avoir). Ex. « AXI-FACT-2026-042 ». */
  numero: string;
  /** Montant TTC formaté. Ex. « 2 940,00 € TTC ». Optionnel. */
  montantLabel?: string;
  /** Date d'échéance formatée. Ex. « 11/08/2026 ». Optionnelle. */
  dateEcheanceLabel?: string;
  /** true si le document est un avoir (adapte le wording). */
  estAvoir?: boolean;
  /** Message libre de l'admin (multi-lignes, affiché tel quel). Optionnel. */
  messagePersonnalise?: string;
}

function field(p: Partial<Payload>, key: keyof Payload, fallback: string): string {
  const v = p[key];
  return v === undefined || v === null || `${v}`.trim() === "" ? fallback : `${v}`;
}

const COPY = {
  fr: {
    titleFacture: "Votre facture Axion-IA",
    titleAvoir: "Votre avoir Axion-IA",
    intro: (n: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
    bodyFacture: (num: string, montant: string) =>
      `Veuillez trouver ci-joint votre facture ${num}${montant ? ` d'un montant de ${montant}` : ""}, au format PDF.`,
    bodyAvoir: (num: string, montant: string) =>
      `Veuillez trouver ci-joint votre avoir ${num}${montant ? ` d'un montant de ${montant}` : ""}, au format PDF.`,
    echeance: (d: string) =>
      d
        ? `Le règlement est attendu au plus tard le ${d} (coordonnées bancaires sur la facture).`
        : "",
    preview: (echeance: string) =>
      echeance
        ? `PDF joint — règlement attendu au plus tard le ${echeance}.`
        : "PDF joint — coordonnées bancaires sur le document.",
    attachment: "Le document est joint à cet email au format PDF.",
    questions: "Pour toute question, répondez simplement à cet email.",
    close: "Bien cordialement,\nL'équipe Axion-IA",
  },
  en: {
    titleFacture: "Your Axion-IA invoice",
    titleAvoir: "Your Axion-IA credit note",
    intro: (n: string) => (n ? `Hello ${n},` : "Hello,"),
    bodyFacture: (num: string, montant: string) =>
      `Please find attached your invoice ${num}${montant ? ` for ${montant}` : ""}, in PDF format.`,
    bodyAvoir: (num: string, montant: string) =>
      `Please find attached your credit note ${num}${montant ? ` for ${montant}` : ""}, in PDF format.`,
    echeance: (d: string) => (d ? `Payment is due by ${d} (bank details are on the invoice).` : ""),
    preview: (echeance: string) =>
      echeance
        ? `PDF attached — payment due by ${echeance}.`
        : "PDF attached — bank details are on the document.",
    attachment: "The document is attached to this email in PDF format.",
    questions: "For any question, simply reply to this email.",
    close: "Best regards,\nThe Axion-IA team",
  },
} as const;

export const factureEnvoiSubject = (locale: Locale, payload: Record<string, unknown>): string => {
  const p = payload as Partial<Payload>;
  const num = field(p, "numero", "");
  const estAvoir = p.estAvoir === true;
  if (locale === "fr") {
    return estAvoir ? `Votre avoir ${num}` : `Votre facture ${num}`;
  }
  return estAvoir ? `Your credit note ${num}` : `Your invoice ${num}`;
};

export function FactureEnvoiEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as Partial<Payload>;
  const t = COPY[locale];
  const estAvoir = p.estAvoir === true;
  const message = field(p, "messagePersonnalise", "");
  const num = field(p, "numero", "");
  const montant = field(p, "montantLabel", "");

  return (
    <EmailLayout
      famille="A"
      locale={locale}
      title={estAvoir ? t.titleAvoir : t.titleFacture}
      /* Le pré-en-tête reprenait l'objet mot pour mot. Il porte désormais ce que
         l'objet ne dit pas : le PDF est joint, et l'échéance. C'est exactement
         ce qu'une comptabilité cherche avant d'ouvrir (§3.5 et §7.7). */
      preview={t.preview(field(p, "dateEcheanceLabel", ""))}
    >
      <Text style={emailStyles.paragraphStyle}>
        {estAvoir ? t.bodyAvoir(num, montant) : t.bodyFacture(num, montant)}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.intro(field(p, "clientNom", ""))}</Text>
      {message !== "" &&
        message.split("\n").map((line, i) => (
          <Text key={i} style={emailStyles.paragraphStyle}>
            {line}
          </Text>
        ))}
      {!estAvoir && t.echeance(field(p, "dateEcheanceLabel", "")) !== "" && (
        <Text style={emailStyles.paragraphStyle}>
          {t.echeance(field(p, "dateEcheanceLabel", ""))}
        </Text>
      )}
      <Text style={emailStyles.paragraphStyle}>{t.attachment}</Text>
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
