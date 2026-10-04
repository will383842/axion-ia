/**
 * Lot OPCO A8 — l'interrupteur `OPCO_SUIVI_ENTREPRISE_ENABLED`.
 *
 * Coupe TOUT le suivi de l'entreprise : envoi automatique, bouton de la
 * console, relances, et réponses par la page publique (qui rend alors la page
 * neutre). Défaut ACTIF en production, sauf `"false"` ; COUPÉ en test, sauf
 * `"true"` explicite — un test qui oublie de l'ouvrir ne doit rien envoyer.
 *
 * Lecture de `process.env` à chaque appel : module atteint par le worker, sans
 * import Next.
 */
export function suiviEntrepriseActif(env: NodeJS.ProcessEnv = process.env): boolean {
  const brut = env["OPCO_SUIVI_ENTREPRISE_ENABLED"];
  if (brut === "false") return false;
  if (env["NODE_ENV"] === "test" || env["VITEST"] !== undefined) return brut === "true";
  return true;
}
