/**
 * GUIDES PAR RÉSEAU — l'INTERRUPTEUR (lot PV-1, 2026-11-01).
 *
 * 🔴 ÉTEINT PAR DÉFAUT. Tant que `GUIDES_RESEAU_ENABLED` n'est pas exactement `"true"`,
 * la route répond 503 et rien n'est lu ni écrit. Nom du plan (la consigne orale parlait de
 * `DEMANDES_GUIDE_RESEAU_ENABLED` : c'est `GUIDES_RESEAU_ENABLED` qui fait foi).
 *
 * ⛔ REPORT ACTÉ : `GUIDES_RESEAU_ENABLED` NE S'ALLUME PAS avant le lot « demande d'effacement
 * reçue en message privé → alerte à l'opérateur, adresse masquée par `redactEmail`, aucune
 * suppression automatique ». Le contrat (`contrat.ts`) n'a pas de chemin d'effacement : tant
 * que ce lot n'est pas livré, le parcours ne doit pas recevoir de vraies demandes. Garde :
 * le test « éteint par défaut » (`config.spec.ts`).
 *
 * Lecture en `process.env` brut, hors schéma `env.ts`, AU RUNTIME uniquement (Coolify,
 * scope RUN, conteneur app) — jamais un build-arg.
 */
export function guidesReseauActifs(): boolean {
  return process.env.GUIDES_RESEAU_ENABLED === "true";
}
