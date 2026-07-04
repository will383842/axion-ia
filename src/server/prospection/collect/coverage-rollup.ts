/**
 * Prospection — Rollup de couverture dép → région → France (T4, pur).
 *
 * Calcule `GeoCoverageStat` à partir de compteurs par département (eux-mêmes
 * issus d'un COUNT réel côté worker → anti-dérive). Aucune division par zéro
 * (agrégats tolérants au Proxy stub qui renvoie 0). SSOT dép→région.
 */

import type { GeoScope } from "@/lib/prospection/enums";
import { regionOfDepartement } from "@/lib/prospection/departement-to-region";

export interface CoverageCounters {
  stockAttendu: number;
  collectees: number;
  enrichies: number;
  exploitables: number;
  partiels: number;
  nonContactables: number;
  /** Nombre d'entreprises périmées (fraîcheur) — optionnel. */
  perimees?: number;
}

export interface GeoStat extends CoverageCounters {
  scope: GeoScope;
  scopeId: string;
  dimKey: string;
  pctCompletion: number;
  pctExploitableSurCollectees: number;
  pctExploitableSurStock: number;
  pctPerime: number;
}

/** Clé de dimension (secteur/taille/type) — `*` = agrégat toutes valeurs. */
export function dimKey(
  secteur?: string | null,
  taille?: string | null,
  type?: string | null,
): string {
  return `${secteur ?? "*"}|${taille ?? "*"}|${type ?? "*"}`;
}

function ratio(num: number, den: number): number {
  if (den <= 0) return 0;
  const r = num / den;
  if (!Number.isFinite(r)) return 0;
  // Un taux de complétion/couverture ne dépasse jamais 100 % : on borne à 1
  // (garde-fou contre un numérateur légèrement plus inclusif que le dénominateur
  // Stock — ex. entreprises sans tranche d'effectif). Cf. vérif finale (data).
  return Math.min(1, r);
}

/** Calcule les pourcentages d'un jeu de compteurs (jamais de div/0). */
export function computeMetrics(c: CoverageCounters): {
  pctCompletion: number;
  pctExploitableSurCollectees: number;
  pctExploitableSurStock: number;
  pctPerime: number;
} {
  return {
    pctCompletion: ratio(c.collectees, c.stockAttendu),
    pctExploitableSurCollectees: ratio(c.exploitables, c.collectees),
    pctExploitableSurStock: ratio(c.exploitables, c.stockAttendu),
    pctPerime: ratio(c.perimees ?? 0, c.collectees),
  };
}

function emptyCounters(): CoverageCounters {
  return {
    stockAttendu: 0,
    collectees: 0,
    enrichies: 0,
    exploitables: 0,
    partiels: 0,
    nonContactables: 0,
    perimees: 0,
  };
}

function add(a: CoverageCounters, b: CoverageCounters): void {
  a.stockAttendu += b.stockAttendu;
  a.collectees += b.collectees;
  a.enrichies += b.enrichies;
  a.exploitables += b.exploitables;
  a.partiels += b.partiels;
  a.nonContactables += b.nonContactables;
  a.perimees = (a.perimees ?? 0) + (b.perimees ?? 0);
}

function toStat(scope: GeoScope, scopeId: string, c: CoverageCounters): GeoStat {
  return { scope, scopeId, dimKey: dimKey(), ...c, ...computeMetrics(c) };
}

/**
 * Rollup 3 niveaux. Entrée = compteurs par département (recomputés depuis COUNT).
 * Sortie = GeoStat pour chaque département + chaque région + la France.
 */
export function rollupDepartementsToRegionsToFrance(
  perDepartement: ReadonlyMap<string, CoverageCounters>,
): GeoStat[] {
  const regionAgg = new Map<string, CoverageCounters>();
  const franceAgg = emptyCounters();
  const stats: GeoStat[] = [];

  for (const [dep, counters] of perDepartement) {
    stats.push(toStat("departement", dep, counters));
    const region = regionOfDepartement(dep);
    const r = regionAgg.get(region) ?? emptyCounters();
    add(r, counters);
    regionAgg.set(region, r);
    add(franceAgg, counters);
  }

  for (const [region, counters] of regionAgg) {
    stats.push(toStat("region", region, counters));
  }
  stats.push(toStat("france", "FR", franceAgg));

  return stats;
}
