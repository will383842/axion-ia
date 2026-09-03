/**
 * Quotas indicatifs par phase du démarrage progressif du générateur de contenu.
 *
 * 🔴 Ce fichier existe parce que `expansion-state.ts` porte `"use server"`, et
 * qu'un tel module ne peut exporter QUE des fonctions asynchrones. Next.js le
 * refuse au chargement — et ce n'est pas l'action qui casse, c'est la page
 * entière qui l'importe.
 *
 * Le défaut était LATENT : rien n'importait `expansion-state.ts`, donc le module
 * n'était jamais chargé et l'erreur ne se déclenchait jamais. Le premier écran
 * qui aurait voulu lire ces quotas aurait planté sans rapport apparent avec eux.
 *
 * Trouvé le 2026-09-03 par `le-use-server-n-exporte-que-des-fonctions.spec.ts`,
 * écrit après que le même défaut a cassé la fiche candidat du chantier
 * recrutement.
 */

import type { ExpansionPhaseSlug } from "./expansion-state";

/**
 * Quotas indicatifs par phase (villes × verticales × dailyArticles plafonné).
 * Consommés par admin UI + worker orchestrator (filtre safety net).
 */
export const PHASE_QUOTAS: Record<
  ExpansionPhaseSlug,
  {
    readonly verticalesCount: number;
    readonly villesCount: number;
    readonly maxDailyArticles: number;
    readonly humanLabel: string;
  }
> = {
  phase_a: {
    verticalesCount: 1,
    villesCount: 5,
    maxDailyArticles: 10,
    humanLabel: "MVP pilote (mois 0-3)",
  },
  phase_b: {
    verticalesCount: 3,
    villesCount: 50,
    maxDailyArticles: 30,
    humanLabel: "Scale prudent (mois 4-6)",
  },
  phase_c: {
    verticalesCount: 5,
    villesCount: 500,
    maxDailyArticles: 100,
    humanLabel: "Montée vitesse (mois 7-12)",
  },
  phase_d: {
    verticalesCount: 5,
    villesCount: 2150,
    maxDailyArticles: 300,
    humanLabel: "Nationale full (mois 13-24)",
  },
};
