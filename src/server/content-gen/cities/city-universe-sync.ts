/**
 * Synchronisation du sous-système « univers villes » (P0 2026-07-03).
 *
 * Contexte : les tables `City` (cities-coverage, city-equity) et
 * `CityGenerationOrder` (coverage-map, cities-order) sont alimentées par des
 * seeds MANUELS jamais câblés au déploiement → vides en prod → ces pages
 * affichent 0. En outre, `City.isCovered`/`articlesCount` n'étaient jamais
 * recalculés depuis les articles publiés.
 *
 * Ce module fournit une synchro idempotente, déclenchable au runtime (bouton
 * admin) avec la VRAIE DB, sans accès shell :
 *   - `seedCityUniverse()` : upsert `City` + `CityGenerationOrder` depuis la SSOT
 *     statique `VILLES` (2159 communes ≥ 5000 hab), via createMany(skipDuplicates)
 *     — rapide sur table vide, no-op sur table déjà peuplée.
 *   - `recomputeCityCoverage()` : recalcule articlesCount/isCovered/lastArticleAt
 *     de chaque ville depuis les ContentGenJob `published` (par anchorVilleSlug).
 *   - `refreshCityCoverageForSlug()` : recount ciblé d'UNE ville (hook publish).
 *
 * Le mapping VILLES → lignes DB est extrait en fonction PURE `buildCityUniverseRows`
 * (aucune dépendance DB) → testable en isolation.
 */

import { prisma } from "@/lib/prisma";
import { REGIONS } from "@/content/regions";

export interface CityUpsertRow {
  slug: string;
  name: string;
  population: number;
  departmentCode: string;
  departmentName: string;
  regionSlug: string;
  regionName: string;
  inseeCode: string;
  latitude: number;
  longitude: number;
  populationTier: number;
  priority: number;
  hasEconomicData: boolean;
}

export interface OrderUpsertRow {
  villeSlug: string;
  rank: number;
  regionSlug: string;
  deptCode: string;
  tier: string; // "T1" | "T2" | "T3" | "T4"
  pop: number;
}

/** Tiers alignés sur `getPopulationTier` (seed-cities) + schéma City. */
export function populationTier(pop: number): number {
  if (pop >= 100_000) return 1;
  if (pop >= 20_000) return 2;
  if (pop >= 10_000) return 3;
  return 4;
}

/** Entrée minimale attendue depuis `VILLES` (sous-ensemble de `Ville`). */
export interface VilleLike {
  slug: string;
  nameFr: string;
  region: string;
  departement: string;
  departementLabel?: string;
  inseeCode: string;
  population: number;
  geo: { lat: number; lon: number };
  economicData?: unknown;
}

/**
 * Mapping PUR VILLES → lignes City + CityGenerationOrder. Trie par population
 * décroissante pour dériver `priority`/`rank` (Paris = 1). Aucune I/O.
 */
export function buildCityUniverseRows(villes: ReadonlyArray<VilleLike>): {
  cityRows: CityUpsertRow[];
  orderRows: OrderUpsertRow[];
} {
  const regionNameBySlug = new Map(REGIONS.map((r) => [r.slug, r.nameFr] as const));
  const sorted = [...villes].sort((a, b) => b.population - a.population);

  const cityRows: CityUpsertRow[] = [];
  const orderRows: OrderUpsertRow[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const v = sorted[i]!;
    const rank = i + 1;
    const tier = populationTier(v.population);
    const regionName = regionNameBySlug.get(v.region) ?? v.region;
    const departmentName = v.departementLabel ?? v.departement;

    cityRows.push({
      slug: v.slug,
      name: v.nameFr,
      population: v.population,
      departmentCode: v.departement,
      departmentName,
      regionSlug: v.region,
      regionName,
      inseeCode: v.inseeCode,
      latitude: v.geo.lat,
      longitude: v.geo.lon,
      populationTier: tier,
      priority: rank,
      hasEconomicData: Boolean(v.economicData),
    });

    orderRows.push({
      villeSlug: v.slug,
      rank,
      regionSlug: v.region,
      deptCode: v.departement,
      tier: `T${tier}`,
      pop: v.population,
    });
  }

  return { cityRows, orderRows };
}

/**
 * Seed idempotent des deux tables univers depuis `VILLES`. createMany +
 * skipDuplicates : insère les manquantes (rapide sur table vide), ignore les
 * existantes (no-op sur re-run). Import dynamique de VILLES (2159 communes) pour
 * ne pas alourdir le module-eval.
 */
export async function seedCityUniverse(): Promise<{
  citiesInserted: number;
  orderInserted: number;
  universeSize: number;
}> {
  const { VILLES } = await import("@/content/villes");
  const { cityRows, orderRows } = buildCityUniverseRows(VILLES as ReadonlyArray<VilleLike>);

  const [cityRes, orderRes] = await Promise.all([
    prisma.city.createMany({ data: cityRows, skipDuplicates: true }),
    prisma.cityGenerationOrder.createMany({ data: orderRows, skipDuplicates: true }),
  ]);

  return {
    citiesInserted: cityRes.count,
    orderInserted: orderRes.count,
    universeSize: cityRows.length,
  };
}

/**
 * Recalcule la couverture de TOUTES les villes depuis les jobs publiés
 * (par `anchorVilleSlug`). Reset global puis update des seules villes couvertes
 * (1 + N requêtes, N = villes ayant ≥ 1 article publié). Autoritaire (recount,
 * pas d'incrément → aucun drift).
 */
export async function recomputeCityCoverage(): Promise<{ coveredCities: number }> {
  // 1. Reset (une ville ayant perdu tous ses articles repasse à non-couverte).
  await prisma.city.updateMany({
    data: { isCovered: false, articlesCount: 0, lastArticleAt: null },
  });

  // 2. Comptage des jobs publiés par ville.
  const grouped = await prisma.contentGenJob.groupBy({
    by: ["anchorVilleSlug"],
    where: { status: "published", anchorVilleSlug: { not: null } },
    _count: { _all: true },
    _max: { completedAt: true },
  });

  let coveredCities = 0;
  for (const g of grouped) {
    const slug = g.anchorVilleSlug;
    if (!slug) continue;
    const res = await prisma.city.updateMany({
      where: { slug },
      data: {
        isCovered: true,
        articlesCount: g._count._all,
        lastArticleAt: g._max.completedAt ?? null,
      },
    });
    if (res.count > 0) coveredCities += res.count;
  }

  return { coveredCities };
}

/**
 * Rafraîchit la couverture d'UNE ville (recount de ses jobs publiés). Best-effort,
 * appelé après publication d'un article (hook worker). Ne throw jamais.
 */
export async function refreshCityCoverageForSlug(slug: string): Promise<void> {
  if (!slug) return;
  try {
    const agg = await prisma.contentGenJob.aggregate({
      where: { status: "published", anchorVilleSlug: slug },
      _count: { _all: true },
      _max: { completedAt: true },
    });
    const count = agg._count._all;
    await prisma.city.updateMany({
      where: { slug },
      data: {
        isCovered: count > 0,
        articlesCount: count,
        lastArticleAt: agg._max.completedAt ?? null,
      },
    });
  } catch {
    // Best-effort : la couverture sera de toute façon rétablie par le recompute
    // global (bouton admin / cron). On n'échoue jamais la publication pour ça.
  }
}

/**
 * Synchro complète (seed univers + recompute couverture). Déclenchée par le
 * bouton admin. Idempotente.
 */
export async function syncCityUniverseAndCoverage(): Promise<{
  citiesInserted: number;
  orderInserted: number;
  universeSize: number;
  coveredCities: number;
}> {
  const seed = await seedCityUniverse();
  const cov = await recomputeCityCoverage();
  return { ...seed, ...cov };
}
