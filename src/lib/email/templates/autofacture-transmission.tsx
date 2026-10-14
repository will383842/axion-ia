// Email — transmission au sous-traitant de la facture d'honoraires que
// l'organisme a établie EN SON NOM, sous mandat de facturation. PDF joint.
//
// 🔴 CET E-MAIL N'EST PAS UNE COURTOISIE : IL OUVRE UN DÉLAI.
//
// La clause 4 bis du contrat de sous-traitance donne au sous-traitant HUIT
// JOURS pour contester la pièce, « à compter de sa transmission ». C'est cet
// envoi qui fait courir ce délai — pas l'émission. Un formateur qui n'a rien
// reçu ne conteste pas, et une facture non contestée est réputée acceptée : le
// droit de contestation est l'une des quatre conditions de régularité de
// l'autofacturation, et il serait vidé de son sens par un envoi qui n'arrive
// pas.
//
// D'où deux conséquences dans le corps du message :
//   · la date limite est CALCULÉE et écrite en clair, jamais « sous huitaine »
//     que le lecteur devrait convertir ;
//   · le moyen de contester est dit explicitement (répondre à cet e-mail), et
//     il n'est pas caché derrière un lien.
//
// Famille A — pièce contractuelle. Sobriété obligatoire : aucune promotion,
// aucun partage, deux liens au maximum. C'est le régime des factures et des
// e-mails de sécurité, et ici la pièce jointe EST le document opposable.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  /** Prénom + nom du sous-traitant. */
  sousTraitantNom: string;
  /** N° de la pièce, série `AXI-AUTOF`. */
  numero: string;
  /** Période des honoraires. Ex. « août 2026 ». */
  periodeLabel: string;
  /** Montant TTC formaté. Ex. « 1 440,00 € TTC ». */
  montantLabel: string;
  /** Échéance de règlement formatée. Ex. « 10/10/2026 ». */
  dateEcheanceLabel: string;
  /** Terme du droit de contestation, formaté. Ex. « 18/09/2026 ». */
  contestationAvantLabel: string;
  /**
   * F36, variante « mission » (lot D2, M22) : paiement PAR MISSION. Ex.
   * « « IA générative » du 16/11/2026 au 17/11/2026 ». Absent : le texte du
   * relevé mensuel, inchangé.
   */
  missionLabel?: string;
}

function field(p: Partial<Payload>, key: keyof Payload, fallback: string): string {
  const v = p[key];
  return v === undefined || v === null || `${v}`.trim() === "" ? fallback : `${v}`;
}

const COPY = {
  fr: {
    title: "Votre facture d'honoraires",
    intro: (n: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
    corps: (num: string, periode: string, montant: string) =>
      `Conformément au mandat de facturation que vous nous avez donné, nous avons établi en votre nom et pour votre compte la facture d'honoraires ${num}${periode ? ` pour la période de ${periode}` : ""}${montant ? `, d'un montant de ${montant}` : ""}. Elle est jointe au format PDF.`,
    // 🔑 Le droit de contestation vient AVANT l'échéance de règlement : c'est
    // celui des deux qui appelle une action de sa part, et celui dont le délai
    // est le plus court.
    contestation: (d: string) =>
      d
        ? `Si son contenu ne correspond pas à ce que vous avez réalisé, vous disposez de huit jours pour nous le signaler, soit jusqu'au ${d} inclus : il vous suffit de répondre à cet e-mail. Passé ce délai, la facture est réputée acceptée.`
        : "Si son contenu ne correspond pas à ce que vous avez réalisé, répondez simplement à cet e-mail.",
    echeance: (d: string) => (d ? `Le règlement vous parviendra au plus tard le ${d}.` : ""),
    mandat:
      "Vous restez le fournisseur de cette prestation et, le cas échéant, seul redevable de la TVA mentionnée. Vous pouvez révoquer ce mandat à tout moment par écrit : vous établirez alors vous-même vos factures.",
    preview: (contestation: string) =>
      contestation
        ? `PDF joint — vous pouvez contester son contenu jusqu'au ${contestation}.`
        : "PDF joint — facture établie en votre nom sous mandat.",
    close: "Bien cordialement,\nL'équipe Axion-IA",
  },
  en: {
    title: "Your fee invoice",
    intro: (n: string) => (n ? `Hello ${n},` : "Hello,"),
    corps: (num: string, periode: string, montant: string) =>
      `Under the invoicing mandate you granted us, we have issued in your name and on your behalf the fee invoice ${num}${periode ? ` for ${periode}` : ""}${montant ? `, for ${montant}` : ""}. It is attached in PDF format.`,
    contestation: (d: string) =>
      d
        ? `If its content does not match what you delivered, you have eight days to tell us, until ${d} inclusive: simply reply to this email. After that date the invoice is deemed accepted.`
        : "If its content does not match what you delivered, simply reply to this email.",
    echeance: (d: string) => (d ? `Payment will reach you by ${d} at the latest.` : ""),
    mandat:
      "You remain the supplier of this service and, where applicable, solely liable for the VAT shown. You may revoke this mandate at any time in writing: you would then issue your own invoices.",
    preview: (contestation: string) =>
      contestation
        ? `PDF attached — you may dispute its content until ${contestation}.`
        : "PDF attached — invoice issued in your name under mandate.",
    close: "Best regards,\nThe Axion-IA team",
  },
} as const;

/**
 * F36, variante « mission » (lot D2) : « Mission » à la place de « période », le
 * désaccord se signale aussi depuis l'espace. L'échéance est dite sans sa règle : 30 jours
 * après la facture le plus souvent, mais une facture rectifiée garde celle de la pièce
 * remplacée et une indemnité sa date fixe (`echeance-autofacture.ts`). Français seulement (l'espace formateur est en français).
 */
const COPY_MISSION = {
  corps: (num: string, mission: string, montant: string) =>
    `Conformément au mandat de facturation que vous nous avez donné, nous avons établi en votre nom et pour votre compte la facture d'honoraires ${num} pour la mission ${mission}${montant ? `, d'un montant de ${montant}` : ""}. Elle est jointe au format PDF.`,
  contestation: (d: string) =>
    d
      ? `Si quelque chose vous semble inexact, vous avez huit jours pour nous le signaler, soit jusqu'au ${d} inclus : depuis votre espace (« Signaler un désaccord »), ou en répondant à cet e-mail. Passé ce délai, la facture est réputée acceptée.`
      : "Si quelque chose vous semble inexact, signalez-le depuis votre espace (« Signaler un désaccord »), ou répondez à cet e-mail.",
  echeance: (d: string) => (d ? `Le virement est prévu au plus tard le ${d}.` : ""),
} as const;

export const autofactureTransmissionSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as Partial<Payload>;
  const num = field(p, "numero", "");
  return locale === "fr" ? `Votre facture d'honoraires ${num}` : `Your fee invoice ${num}`;
};

export function AutofactureTransmissionEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as Partial<Payload>;
  const t = COPY[locale];
  const contestation = field(p, "contestationAvantLabel", "");
  const mission = locale === "fr" ? field(p, "missionLabel", "") : "";
  const echeance =
    mission !== ""
      ? COPY_MISSION.echeance(field(p, "dateEcheanceLabel", ""))
      : t.echeance(field(p, "dateEcheanceLabel", ""));

  return (
    <EmailLayout famille="A" locale={locale} title={t.title} preview={t.preview(contestation)}>
      <Text style={emailStyles.paragraphStyle}>{t.intro(field(p, "sousTraitantNom", ""))}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {mission !== ""
          ? COPY_MISSION.corps(field(p, "numero", ""), mission, field(p, "montantLabel", ""))
          : t.corps(
              field(p, "numero", ""),
              field(p, "periodeLabel", ""),
              field(p, "montantLabel", ""),
            )}
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        {mission !== "" ? COPY_MISSION.contestation(contestation) : t.contestation(contestation)}
      </Text>
      {echeance !== "" && <Text style={emailStyles.paragraphStyle}>{echeance}</Text>}
      <Text style={emailStyles.paragraphStyle}>{t.mandat}</Text>
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
