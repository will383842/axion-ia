// Email — pièces de remboursement OPCO, transmises à l'entreprise APRÈS le
// règlement intégral de sa facture (lot A8c, 2026-10-04).
//
// Circuit « remboursement » de la réforme du 1/10/2026 : l'entreprise paie
// l'organisme, puis son OPCO la rembourse sur pièces. Ce message lui remet ce
// qu'elle doit présenter — la facture, attestée acquittée, et le(s)
// certificat(s) de réalisation — sans rien promettre de la décision de l'OPCO.
//
// Préparé par l'encaissement qui solde la facture
// (`financements/transmission-remboursement-opco.ts`) et TOUJOURS garé en
// « E-mails à valider » : rien ne part à un client sans validation.
// Les PDF sont attachés par le worker (clés R2 dans EmailJobData.attachments).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  clientNom?: string;
  /** N° de la facture. Ex. « AXI-FACT-2026-042 ». */
  numero?: string;
  /** Montant TTC réglé, formaté. Ex. « 1 800,00 € TTC ». */
  montantLabel?: string;
  /** Date du règlement complet, formatée. Ex. « 14/10/2026 ». */
  payeeLe?: string;
  /** Nom lisible de l'OPCO. Ex. « Atlas ». */
  opcoNom?: string;
  /** Intitulé de la formation. */
  intituleFormation?: string;
  /** Les pièces jointes, telles qu'annoncées. */
  pieces?: string[];
}

function field(p: Partial<Payload>, key: keyof Payload, fallback: string): string {
  const v = p[key];
  return v === undefined || v === null || `${v}`.trim() === "" ? fallback : `${v}`;
}

const COPY = {
  fr: {
    title: "Vos pièces pour le remboursement OPCO",
    intro: (n: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
    acquittee: (num: string, montant: string, le: string) =>
      `Nous accusons réception du règlement intégral de la facture ${num}` +
      `${montant ? ` (${montant})` : ""}${le ? `, le ${le}` : ""} : cette facture est acquittée.`,
    objet: (opco: string, formation: string) =>
      `Pour votre demande de remboursement auprès de votre OPCO${opco ? ` (${opco})` : ""}` +
      `${formation ? ` au titre de la formation « ${formation} »` : ""}, vous trouverez ci-joint :`,
    piecesDefaut: ["La facture, acquittée", "Le certificat de réalisation"],
    rappel:
      "La décision et le montant du remboursement relèvent de votre OPCO, selon son accord de prise en charge.",
    questions: "Pour toute question, répondez simplement à cet email.",
    close: "Bien cordialement,\nL'équipe Axion-IA",
    preview: "Facture acquittée et certificat de réalisation joints.",
  },
  en: {
    title: "Your documents for the OPCO reimbursement",
    intro: (n: string) => (n ? `Hello ${n},` : "Hello,"),
    acquittee: (num: string, montant: string, le: string) =>
      `We acknowledge full payment of invoice ${num}${montant ? ` (${montant})` : ""}` +
      `${le ? ` on ${le}` : ""}: this invoice is paid.`,
    objet: (opco: string, formation: string) =>
      `For your reimbursement request to your OPCO${opco ? ` (${opco})` : ""}` +
      `${formation ? ` for the training « ${formation} »` : ""}, please find attached:`,
    piecesDefaut: ["The invoice, marked paid", "The certificate of completion"],
    rappel: "The reimbursement decision and amount are your OPCO's, under its funding agreement.",
    questions: "For any question, simply reply to this email.",
    close: "Best regards,\nThe Axion-IA team",
    preview: "Paid invoice and certificate of completion attached.",
  },
} as const;

// Objet ≤ 45 caractères (référentiel e-mail §3.4) : le numéro et « acquittée »
// disent l'essentiel ; l'objet de la démarche est dans le corps.
export const facturePiecesRemboursementOpcoSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const num = field(payload as Partial<Payload>, "numero", "");
  if (locale === "fr") return num ? `Facture ${num} acquittée` : "Votre facture acquittée";
  return num ? `Invoice ${num} paid` : "Your paid invoice";
};

export function FacturePiecesRemboursementOpcoEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as Partial<Payload>;
  const t = COPY[locale];
  const pieces =
    Array.isArray(p.pieces) && p.pieces.length > 0
      ? p.pieces.filter((x): x is string => typeof x === "string")
      : [...t.piecesDefaut];

  return (
    <EmailLayout famille="A" locale={locale} title={t.title} preview={t.preview}>
      <Text style={emailStyles.paragraphStyle}>{t.intro(field(p, "clientNom", ""))}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {t.acquittee(field(p, "numero", ""), field(p, "montantLabel", ""), field(p, "payeeLe", ""))}
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        {t.objet(field(p, "opcoNom", ""), field(p, "intituleFormation", ""))}
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        {pieces.map((piece, i) => (
          <span key={i}>
            • {piece}
            <br />
          </span>
        ))}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.rappel}</Text>
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
