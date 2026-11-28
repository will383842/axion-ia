// Réseau d'apporteurs — la Journée IA suit la grille SIGNÉE (point 17, #2464).
//
// La Journée IA n'apparaît dans aucune annexe 1 de version 2 (contrats 2.3 à 2.6) : créée après la
// signature, elle est, pour ces apporteurs, une prestation HORS GRILLE au sens d'A1.7. Elle n'a ni
// 500 € automatiques ni 0 € silencieux : la commission naît « à qualifier » avec le repère
// « hors grille », et suit le circuit existant (60 jours de l'encaissement, alertes J-10 et J).
// Grille v3 (avenant 2.8) : 500 € par journée au prorata, calcul inchangé.
// Aucune ligne « Journée IA » n'est publiée dans la grille de référence (décision de Will).
// Module pur : ni base ni `server-only`.

import {
  calculerCommissionJourneeIa,
  type ActiviteCommission,
  type CalculCommission,
  type GrilleCommission,
} from "./regles";

/**
 * Même valeur que `PALIER_HORS_GRILLE` (hors-grille.ts), recopiée ici : `hors-grille` importe
 * `commissions`, qui importe ce module : un import ferait un cycle. Égalité verrouillée par test.
 */
export const PALIER_JOURNEE_IA_HORS_GRILLE = "hors-grille";

export const MESSAGE_JOURNEE_IA_GRILLE_V2 =
  "Contrat signé en grille 2.6 ou antérieure : la Journée IA n'y figure pas (annexe 1, A1.5 et A1.7). Elle se traite comme une prestation hors grille : publiez sa commission ou constatez par écrit qu'elle n'est pas commissionnée, dans les 60 jours de l'encaissement.";

export function commissionJourneeIaSelonGrille(e: {
  grille: GrilleCommission;
  activite: ActiviteCommission | null;
  lignes: unknown;
  netHtCents: number;
}): { calcul: CalculCommission; palierAQualifier: string | null } {
  if (e.grille === "v2")
    return { calcul: { statut: "a_qualifier" }, palierAQualifier: PALIER_JOURNEE_IA_HORS_GRILLE };
  return {
    calcul: calculerCommissionJourneeIa({
      activite: e.activite,
      lignes: e.lignes,
      netHtCents: e.netHtCents,
    }),
    palierAQualifier: null,
  };
}
