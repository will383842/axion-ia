/**
 * Les codes d'ALERTE du circuit du compte rendu (chantier visio, PR 6 ;
 * anti-doublon A3 de l'audit du 29/09).
 *
 * Mêmes règles que ceux de l'enregistreur (`balayage-enregistreur.ts`) : des
 * `AlerteSysteme` créées par `creerOuDedup`, codes `visio.*` inscrits au
 * catalogue (`ALERTE_CATALOGUE`, guichet et motif), jamais une table
 * parallèle. Aucune parole, aucun nom : des identifiants et des nombres.
 *
 * Garde : `__tests__/les-codes-d-alerte-du-circuit-sont-au-catalogue.spec.ts`.
 *
 * Module PUR.
 */

export const CODES_ALERTES_CIRCUIT = {
  /** Crédit OpenAI épuisé, plafond atteint, clé absente : le circuit est en pause. */
  circuitSuspendu: "visio.circuit_suspendu",
  /** Une étape a échoué définitivement : note manuelle proposée. */
  etapeEnEchec: "visio.etape_en_echec",
  /** La base n'est pas migrée depuis plus de 2 heures. */
  schemaEnRetard: "visio.schema_en_retard",
  /** Une demande d'arrêt de l'enregistrement a été entendue. */
  demandeDArret: "visio.demande_d_arret",
  /** Un compte rendu attend la validation de Will (rappel de travail, console). */
  compteRenduAValider: "visio.compte_rendu_a_valider",
  /** Un son n'a pas été supprimé à son échéance. */
  audioNonPurge: "visio.audio_non_purge",
  /** Une étape attend une réponse de Will (enregistrement de moins de 90 s). */
  reponseAttendue: "visio.reponse_attendue",
} as const;
