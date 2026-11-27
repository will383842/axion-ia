/**
 * Réseau d'apporteurs — l'interrupteur des challenges, côté espace.
 * Ouvre : L'encart « la règle » et la page du règlement dans l'espace de l'apporteur.
 *
 * ABSENT = ÉTEINT : allumé SEULEMENT si `APPORTEUR_CHALLENGES_ESPACE_ENABLED` vaut exactement
 * "true" (« TRUE », « 1 », « true » entouré d'espaces : éteint). Lu à CHAQUE appel, jamais figé à
 * l'import. Côté SERVEUR seulement (la variable n'est pas `NEXT_PUBLIC_`).
 */
export function challengesEspaceActifs(): boolean {
  return process.env.APPORTEUR_CHALLENGES_ESPACE_ENABLED === "true";
}
