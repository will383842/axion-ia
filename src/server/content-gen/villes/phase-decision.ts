/**
 * Content Generator — Décision de phase villes (PH5, plan §5 / pack 02).
 *
 * Helper PUR pour le phasage « profondeur avant volume » des villes (piloté en
 * CLI — `scripts/regen-villes-*.ts`). Décide la prochaine phase à générer pour une
 * ville selon les gates de dépendance : une phase N n'est éligible que si la phase
 * N-1 a atteint `minArticlesInDepPhase` articles tier-1 publiés.
 *
 * Usage CLI (exemple) :
 *   const next = computeNextVillePhase(publishedByPhase, targetByPhase);
 *   if (next) enqueueVillePhase(villeSlug, next);  // sinon : ville couverte
 *
 * NOTE secteur (plan, décision Will) : `CITY_SECTOR_PRIORITIES.secteursPrioritaires`
 * du pack référence des secteurs INDUSTRIE (string[]) à mapper sur le SSOT
 * `sectorTag`/`SECTORS` — mapping éditorial non bijectif laissé à arbitrage.
 */

import { PHASE_DEFINITIONS, type CoveragePhase } from "./phased-coverage";

/**
 * Retourne la prochaine phase à lancer, ou `null` si tout est couvert / si un gate
 * de dépendance n'est pas encore satisfait (on attend). Pur, déterministe.
 *
 * @param publishedByPhase nb d'articles tier-1 publiés par phase pour la ville.
 * @param targetByPhase cible par phase. Sans cible pour une phase → elle est
 *   considérée « ouverte » (jamais terminée) tant que son gate amont est satisfait.
 */
export function computeNextVillePhase(
  publishedByPhase: Partial<Record<CoveragePhase, number>>,
  targetByPhase?: Partial<Record<CoveragePhase, number>>,
): CoveragePhase | null {
  for (const def of PHASE_DEFINITIONS) {
    // Gate de dépendance : la phase amont doit avoir assez de tier-1 publiés.
    if (def.dependsOnPhase) {
      const depPublished = publishedByPhase[def.dependsOnPhase] ?? 0;
      if (depPublished < def.minArticlesInDepPhase) {
        // Gate fermé : on n'avance pas (la phase amont — si incomplète — a déjà
        // été renvoyée plus haut dans la boucle ; sinon on attend qu'elle mûrisse).
        return null;
      }
    }
    const published = publishedByPhase[def.phase] ?? 0;
    const target = targetByPhase?.[def.phase];
    if (target === undefined || published < target) {
      return def.phase;
    }
  }
  return null;
}
