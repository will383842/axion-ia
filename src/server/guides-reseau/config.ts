/**
 * GUIDES PAR RÉSEAU — l'INTERRUPTEUR (lot PV-1, 2026-11-01).
 *
 * 🔴 ÉTEINT PAR DÉFAUT. Tant que `GUIDES_RESEAU_ENABLED` n'est pas exactement `"true"`,
 * la route répond 503 et rien n'est lu ni écrit. Nom du plan (la consigne orale parlait de
 * `DEMANDES_GUIDE_RESEAU_ENABLED` : c'est `GUIDES_RESEAU_ENABLED` qui fait foi).
 *
 * Lecture en `process.env` brut, hors schéma `env.ts`, AU RUNTIME uniquement (Coolify,
 * scope RUN, conteneur app) — jamais un build-arg.
 */
export function guidesReseauActifs(): boolean {
  return process.env.GUIDES_RESEAU_ENABLED === "true";
}
