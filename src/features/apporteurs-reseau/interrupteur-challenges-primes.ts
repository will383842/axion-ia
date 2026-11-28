/**
 * Réseau d'apporteurs — l'interrupteur du CONSTAT des primes de challenge (lot I, #2464).
 * Ouvre : l'étape « constat-primes » du passage quotidien (worker).
 *
 * ABSENT = ÉTEINT : allumé SEULEMENT si `APPORTEUR_CHALLENGES_PRIMES_ENABLED` vaut exactement "true".
 * Lu à CHAQUE appel. ⛔ Avant d'allumer : le règlement publié doit porter `paiementJusquAu` (sinon la
 * fenêtre de constat se réduit au lendemain de la fin : demander à Will).
 */
export function challengesPrimesActifs(): boolean {
  return process.env.APPORTEUR_CHALLENGES_PRIMES_ENABLED === "true";
}
