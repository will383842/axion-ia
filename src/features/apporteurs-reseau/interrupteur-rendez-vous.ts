/**
 * Réseau d'apporteurs — l'interrupteur de la validation par rendez-vous (future règle du
 * contrat 2.8, cf. `regle-attribution.ts`).
 *
 * ABSENT = ÉTEINT : allumé SEULEMENT si `APPORTEURS_VALIDATION_RDV` vaut exactement "true"
 * (« TRUE », « 1 », « true » entouré d'espaces : éteint). Lu à CHAQUE appel, jamais figé à
 * l'import : le site et le worker suivent la valeur de leur propre conteneur.
 *
 * Lot 2 (2026-11-25) : rien ne lit encore cette fonction.
 */
export function validationParRendezVousActive(): boolean {
  return process.env.APPORTEURS_VALIDATION_RDV === "true";
}
