// Les deux montants des landings apporteurs, formatés. Jamais écrits en dur dans un texte :
// ils viennent de pricing.ts (garde no-hardcoded-prices).
import { COMMISSION_FORMATION_PAR_JOURNEE_EUR, JOURNEE_IA_TIER } from "@/content/pricing";

export interface Chiffres {
  /** Prix public de la Journée IA, formaté (par exemple « 1 490 € »). */
  prix: string;
  /** Commission indicative par Journée IA payée, formatée. À accompagner de « à titre indicatif ». */
  commission: string;
}

const NBSP = "\u00a0";

function euros(montant: number): string {
  return `${montant.toLocaleString("fr-FR").replace(/[\u202f\s]/g, NBSP)}${NBSP}€`;
}

export function chiffresApporteurs(): Chiffres {
  return {
    prix: euros(JOURNEE_IA_TIER.priceFlat ?? 0),
    commission: euros(COMMISSION_FORMATION_PAR_JOURNEE_EUR),
  };
}

export interface QuestionReponse {
  question: string;
  reponse: string;
}
