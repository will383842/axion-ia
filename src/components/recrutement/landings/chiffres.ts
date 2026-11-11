// Les deux montants des landings apporteurs, formatés. Jamais écrits en dur dans un texte :
// ils viennent de pricing.ts (garde no-hardcoded-prices).
import { COMMISSION_FORMATION_PAR_JOURNEE_EUR, JOURNEE_IA_TIER } from "@/content/pricing";
import { COMMISSIONS_PUBLIQUES_AFFICHEES } from "@/content/recrutement/commission-publique";

export interface Chiffres {
  /** Prix public de la Journée IA, formaté (par exemple « 1 490 € »). */
  prix: string;
  /** Commission indicative par Journée IA payée, formatée. À accompagner de « à titre indicatif ». */
  commission: string;
  /**
   * Règle R7 (ordre de Williams, 08/11/2026) : tant que COMMISSIONS_PUBLIQUES_AFFICHEES est faux,
   * AUCUN montant de commission ne sort au public ; les pages disent « une commission sur chaque
   * Journée IA payée, détaillée dans votre contrat ». Rallumer l'interrupteur affiche les montants.
   */
  commissionPublique: boolean;
}

const NBSP = "\u00a0";

function euros(montant: number): string {
  return `${montant.toLocaleString("fr-FR").replace(/[\u202f\s]/g, NBSP)}${NBSP}€`;
}

export function chiffresApporteurs(): Chiffres {
  return {
    prix: euros(JOURNEE_IA_TIER.priceFlat ?? 0),
    commission: euros(COMMISSION_FORMATION_PAR_JOURNEE_EUR),
    commissionPublique: COMMISSIONS_PUBLIQUES_AFFICHEES,
  };
}

export interface QuestionReponse {
  question: string;
  reponse: string;
}
