/**
 * Formateurs indépendants — « FORMATION COMPLÈTE POUR CE FORMATEUR » (lot G2), pur.
 *
 * Décision du dirigeant (12/10/2026) : un formateur indépendant n'est payé pour une
 * formation que s'il a fait tout ce qui lui revient pour cette formation, c'est-à-dire :
 *   1. ses feuilles de présence contresignées — la règle EXISTANTE (`moisPayable`),
 *      reprise telle quelle, jamais recopiée ;
 *   2. ET son bilan de fin de formation terminé (évaluations finales + avis) — pour le
 *      DERNIER mois de la mission seulement (décision de Will) : sur une mission payée
 *      sur plusieurs mois, les mois précédents se paient sur les feuilles seules.
 *
 * `bilan: null` = le bilan n'est pas exigé (interrupteur `formateurs.bilan_fin_formation`
 * éteint, session finie avant son allumage, salarié…) : le verdict est EXACTEMENT celui de
 * `moisPayable`. « Payer quand même » (administrateur, motivé) lève l'exigence du bilan,
 * jamais celle des feuilles.
 *
 * Aucun montant n'est calculé ici : seule la condition « payable » change.
 */

import {
  demiJourneesPrevues,
  demiJourneesSansSignature,
  demiJourneesSignees,
  type ContresignatureLue,
  type JourneePrevue,
} from "@/server/qualiopi/remuneration/heures-animees";

import { moisPayable, type RaisonNonPayable, type VerdictPayable } from "../argent/calcul-mission";
import {
  PARAMETRES_ARGENT_FORMATEURS,
  type ParametresArgentFormateurs,
} from "../argent/parametres";

export type RaisonFormationIncomplete = RaisonNonPayable | "bilan_fin_formation_manquant";

export interface EtatBilanPourPaiement {
  readonly termine: boolean;
  readonly payerQuandMeme: boolean;
}

export interface VerdictFormationComplete extends Omit<VerdictPayable, "raison"> {
  readonly raison: RaisonFormationIncomplete | null;
}

/** Le motif exact, en clair : affiché tel quel par la console et par l'espace. */
export const LIBELLE_MOTIF_FORMATION_INCOMPLETE: Readonly<
  Record<RaisonFormationIncomplete, string>
> = {
  aucune_signature: "aucune feuille de présence n'est contresignée",
  feuilles_incompletes: "il manque des feuilles de présence contresignées",
  condition_financeur_en_attente: "une condition du financeur est en attente",
  bilan_fin_formation_manquant:
    "il manque le bilan de fin de formation (seul le relevé du dernier mois de la mission l'attend ; les mois précédents se paient sur les feuilles de présence contresignées)",
};

export function formationCompletePourFormateur(e: {
  readonly signees: number;
  readonly manquantes: number;
  readonly conditionFinanceurEnAttente: boolean;
  readonly bilan: EtatBilanPourPaiement | null;
}): VerdictFormationComplete {
  const feuilles = moisPayable(e);
  if (!feuilles.payable) return feuilles;
  if (e.bilan !== null && !e.bilan.termine && !e.bilan.payerQuandMeme) {
    return { payable: false, raison: "bilan_fin_formation_manquant", manquantes: 0 };
  }
  return feuilles;
}

/**
 * Le même verdict à l'échelle de la SESSION entière, pour l'affichage (console) : les
 * demi-journées prévues de ce formateur, ses contresignatures, et le bilan. Il rend le
 * PREMIER motif qui retient un paiement : les feuilles d'abord, le bilan ensuite. Le
 * passage, lui, juge mois par mois : le dernier mois peut attendre le bilan alors qu'un
 * mois précédent attend encore ses feuilles ; la console ne montre alors que les feuilles,
 * et le bilan apparaît dès qu'elles sont complètes. Mêmes
 * fonctions que le passage (`heures-animees.ts`), jamais une seconde lecture des feuilles.
 */
export function formationCompleteSurLaSession(
  e: {
    readonly journeesPrevues: ReadonlyArray<JourneePrevue>;
    readonly contresignatures: ReadonlyArray<ContresignatureLue>;
    readonly conditionFinanceurEnAttente: boolean;
    readonly bilan: EtatBilanPourPaiement | null;
  },
  p: ParametresArgentFormateurs = PARAMETRES_ARGENT_FORMATEURS,
): VerdictFormationComplete {
  const prevues = demiJourneesPrevues(e.journeesPrevues, {
    matinAvant: p.matinAvant,
    apresMidiApres: p.apresMidiApres,
    milieuDeJournee: p.milieuDeJournee,
  });
  const signees = demiJourneesSignees(e.contresignatures);
  return formationCompletePourFormateur({
    signees: signees.length,
    manquantes: demiJourneesSansSignature(prevues, signees).length,
    conditionFinanceurEnAttente: e.conditionFinanceurEnAttente,
    bilan: e.bilan,
  });
}
