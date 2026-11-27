/**
 * Réseau d'apporteurs — l'interrupteur des challenges, côté console.
 * Ouvre : Les écrans de la console (liste, création, publication).
 *
 * ABSENT = ÉTEINT : allumé SEULEMENT si `APPORTEUR_CHALLENGES_CONSOLE_ENABLED` vaut exactement
 * "true" (« TRUE », « 1 », « true » entouré d'espaces : éteint). Lu à CHAQUE appel, jamais figé à
 * l'import. Côté SERVEUR seulement (la variable n'est pas `NEXT_PUBLIC_`).
 */
export function challengesConsoleActifs(): boolean {
  return process.env.APPORTEUR_CHALLENGES_CONSOLE_ENABLED === "true";
}
