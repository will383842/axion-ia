/**
 * Qualiopi — Mapping SSOT : offre (tierId) → page publique /interventions.
 *
 * Harmonisation vitrine ↔ Qualiopi (Option A, confirmé Will 2026-06-07) : la page
 * publique canonique d'une formation est sa fiche marketing /interventions/* (gros
 * actif SEO). Ce mapping relie chaque offre du catalogue Qualiopi à sa fiche, pour :
 *   - rediriger /formations/[slug] → /interventions/* (dé-doublonnage, Phase B) ;
 *   - injecter le bloc « infos réglementaires » sur la bonne fiche.
 *
 * Module PUR (aucun import next/prisma) : importable par pages, redirect et tests.
 * Coaching (coaching-*, claude-implementation-individuel) = produits séparés HORS
 * Qualiopi (accompagnement ≠ action de formation) → volontairement absents.
 */

/** tierId (cf. pricing.ts / offres.ts) → chemin de la fiche publique (locale-agnostique). */
export const OFFRE_TIER_TO_INTERVENTION_PATH: Readonly<Record<string, string>> = {
  "intervention-4h": "/interventions/demarrage-ia-express",
  "intervention-essentielle": "/interventions/essentielle",
  "intervention-temps": "/interventions/gagner-du-temps",
  "intervention-approfondie": "/interventions/approfondie",
  "intervention-dirigeants": "/interventions/dirigeants",
  "intervention-claude": "/interventions/intervention-claude",
  "intervention-dirigeant-vision": "/interventions/dirigeant-vision-strategique",
  "intervention-claude-dirigeant": "/interventions/claude-dirigeant",
  "intervention-conference": "/interventions/collectives",
  "intervention-membre-equipe": "/interventions/individuel",
  "intervention-sur-demande": "/interventions/demande",
} as const;

/** Chemin /interventions pour un tierId, ou null si l'offre n'a pas de fiche publique. */
export function interventionPathForTier(tierId: string): string | null {
  return OFFRE_TIER_TO_INTERVENTION_PATH[tierId] ?? null;
}

/** Map inverse : chemin /interventions → tierId (pour brancher le bloc conformité depuis une fiche). */
export const INTERVENTION_PATH_TO_OFFRE_TIER: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(OFFRE_TIER_TO_INTERVENTION_PATH).map(([tier, path]) => [path, tier]),
);

/** tierId de l'offre rattachée à un chemin /interventions, ou null. */
export function tierForInterventionPath(path: string): string | null {
  return INTERVENTION_PATH_TO_OFFRE_TIER[path] ?? null;
}
