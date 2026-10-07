// Le barème des commissions et la liste « à préparer », COMMUNS aux e-mails apporteurs (2026-10-07).
//
// Une seule rédaction pour « Retenu » et « contrat signé » : les mêmes lignes, tirées des
// MÊMES constantes que le contrat v2 validé (annexe 1) — aucune valeur réécrite à la main.
// La liste « à préparer » lit les pièces réellement demandées à l'étape 3 du dossier.

import {
  COMMISSION_CONFERENCE_EUR,
  COMMISSION_FORMATION_PAR_JOURNEE_EUR,
  getCommissionById,
} from "@/content/pricing";
import { TAUX_BPS } from "@/features/apporteurs-reseau/regles";
import {
  LIBELLE_PIECE,
  PIECES_FACULTATIVES,
  PIECES_POUR_SIGNER,
} from "@/features/apporteurs-reseau/regles-dossier";

type Langue = "fr" | "en";

const PCT_AUDIT = getCommissionById("com-audit").percent ?? 0;
const PCT_INTEGRATION = getCommissionById("com-integration").percent ?? 0;
const PCT_UN_A_UN = TAUX_BPS.un_a_un / 100;

function pourcent(n: number, l: Langue): string {
  return l === "fr" ? `${String(n).replace(".", ",")} %` : `${n}%`;
}

/**
 * AVANT la signature (« Retenu »), le barème est INDICATIF : le contrat fait foi (REQ-JUR-001).
 * Après la signature (« contrat signé »), c'est celui du contrat : la mention n'y figure pas.
 */
export const MENTION_BAREME_INDICATIF =
  "Vous touchez une commission. Le barème ci-dessous est donné à titre indicatif : votre contrat d'apporteur fait foi.";

/** Les lignes du barème, dans l'ordre de l'annexe 1 du contrat. */
export function lignesBareme(l: Langue = "fr"): string[] {
  if (l === "en") {
    return [
      `Training: €${COMMISSION_FORMATION_PAR_JOURNEE_EUR} excl. VAT per training day at the public rate (reduced pro rata if the client is granted a discount).`,
      `Audit: ${pourcent(PCT_AUDIT, l)} of the invoice amount excl. VAT.`,
      `Integration: ${pourcent(PCT_INTEGRATION, l)} of the invoice amount excl. VAT.`,
      `One-to-one support and coaching: ${pourcent(PCT_UN_A_UN, l)} of the invoice amount excl. VAT.`,
      `Talk: €${COMMISSION_CONFERENCE_EUR} excl. VAT per talk ordered (never more than the price invoiced excl. VAT).`,
    ];
  }
  return [
    `Formation : ${COMMISSION_FORMATION_PAR_JOURNEE_EUR} € HT par journée de formation au tarif public (réduite au prorata en cas de remise accordée au client).`,
    `Audit : ${pourcent(PCT_AUDIT, l)} du montant HT de la facture.`,
    `Intégration : ${pourcent(PCT_INTEGRATION, l)} du montant HT de la facture.`,
    `Accompagnement individuel et coaching (1-to-1) : ${pourcent(PCT_UN_A_UN, l)} du montant HT de la facture.`,
    `Conférence : ${COMMISSION_CONFERENCE_EUR} € HT par conférence commandée (jamais plus que le prix HT facturé).`,
  ];
}

/** « Pièce d'identité » → « pièce d'identité » ; un sigle (« RIB ») reste tel quel. */
function enMinuscule(libelle: string): string {
  const premier = libelle.split(" ")[0] ?? "";
  return premier === premier.toUpperCase() ? libelle : libelle[0]!.toLowerCase() + libelle.slice(1);
}

/** Ce qu'il faut avoir sous la main pour compléter le dossier en ligne. */
export function ligneAPreparer(l: Langue = "fr"): string {
  if (l === "en") {
    return "To have at hand: your SIREN number, your IBAN, an identity document, your bank details (RIB) and, if you have one, your professional liability insurance certificate. About 10 minutes; you can resume later.";
  }
  const pieces = [
    ...PIECES_POUR_SIGNER.map((p) => enMinuscule(LIBELLE_PIECE[p])),
    ...PIECES_FACULTATIVES.map((p) => `${enMinuscule(LIBELLE_PIECE[p])} (facultative)`),
  ];
  return `À préparer : votre numéro SIREN, votre IBAN, et à déposer : ${pieces.join(", ")}. Environ 10 minutes, vous pouvez reprendre plus tard.`;
}
