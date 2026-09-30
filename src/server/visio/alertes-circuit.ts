/**
 * Les codes d'ALERTE du circuit du compte rendu (chantier visio, PR 6 ;
 * anti-doublon A3 de l'audit du 29/09).
 *
 * V1 C3 : il n'y a plus qu'UN objet de codes `visio.*`, `CODES_ALERTES_VISIO`
 * (`alertes.ts`) ; ce nom n'en est que l'ALIAS (même objet), gardé pour les
 * modules du circuit qui l'importent. Des `AlerteSysteme` créées par
 * `creerOuDedup`, codes inscrits au catalogue (`ALERTE_CATALOGUE`, guichet et
 * motif), jamais une table parallèle. Aucune parole, aucun nom.
 *
 * Garde : `__tests__/les-codes-d-alerte-du-circuit-sont-au-catalogue.spec.ts`.
 *
 * Module PUR (`alertes.ts` n'importe que des types).
 */

export { CODES_ALERTES_VISIO as CODES_ALERTES_CIRCUIT } from "./alertes";
