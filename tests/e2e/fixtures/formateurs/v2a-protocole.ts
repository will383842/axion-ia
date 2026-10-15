// Banc @formateurs, VÉRIFICATION 2 — équipe A (argent) : le contrat entre un spec `v2a*`
// et `v2a-executer.ts`.
//
// Module PUR, importé des deux côtés (le spec n'importe JAMAIS l'exécuteur, qui
// s'exécute dès son chargement). Les étapes déjà couvertes par l'exécuteur d'argent de
// la vérification 1 (`argent-protocole.ts` : passage, contresignature, émission, garde du
// virement, suivi…) sont jouées par lui, tel quel ; ce protocole n'ajoute que les
// services qu'il n'expose pas. Les instants voyagent en ISO 8601 : c'est l'horloge
// pilotée du banc, passée en paramètre, jamais une horloge truquée.

export const MARQUEUR_RESULTAT_V2A = "@@BANC-V2A@@";

export type EtapeV2a =
  /**
   * « Payer quand même » le bilan de fin de formation (`payerQuandMemeBilan`), le geste
   * de l'administrateur, avec l'interrupteur `formateurs.bilan_fin_formation` allumé à
   * `bilanAllumeLe` le temps de l'étape.
   */
  | {
      readonly etape: "payer-quand-meme";
      readonly bilanAllumeLe: string;
      readonly sessionId: string;
      readonly trainerId: string;
      readonly motif: string;
      readonly maintenant: string;
    }
  /**
   * L'état des virements de MISSION tel que la vue « Virements à faire » l'affiche
   * (`etatsVirementsMission`) : la même garde que « Virement fait », lue pour l'écran.
   */
  | {
      readonly etape: "etats-virements-mission";
      readonly ids: readonly string[];
      readonly maintenant: string;
    }
  /** Le cumul des honoraires HT d'un formateur (`lireCumulHonorairesHtCents`, seuil URSSAF). */
  | { readonly etape: "cumul"; readonly trainerId: string }
  /**
   * Le moteur d'alertes (`evaluerAlertesDetaille`, le passage du worker), lu à l'heure
   * RÉELLE (il ne reçoit pas d'instant) ; seules les candidates qui visent `cibles` sont
   * rendues (code, cible, message).
   */
  | { readonly etape: "alertes"; readonly cibles: readonly string[] };

export interface EntreeV2a {
  readonly etapes: readonly EtapeV2a[];
}

export type SortieV2a = readonly unknown[];
