"use server";

/**
 * Server Actions — Console Couverture Villes 2100 (Phase B Sprint Perfection 2026-05-22).
 *
 * Actions disponibles :
 *   - listCities      : liste paginée + filtrée depuis table `cities`
 *   - getCitiesStats  : statistiques globales de couverture
 *   - markCitiesPriority : marque des villes comme prioritaires (isTargeted=true)
 *   - exportCitiesCSV : export CSV des villes filtrées
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { syncCityUniverseAndCoverage } from "@/server/content-gen/cities/city-universe-sync";
import { requireAdmin } from "./_auth";

// Sprint Final P1-3 — Zod runtime validation des inputs Server Actions.
const SortBySchema = z.enum(["priority", "population", "name", "articlesCount"]);
const SortDirSchema = z.enum(["asc", "desc"]);
const ListCitiesParamsSchema = z
  .object({
    page: z.number().int().min(1).max(100_000).optional(),
    pageSize: z.number().int().min(1).max(500).optional(),
    deptCode: z.string().min(2).max(5).optional(),
    regionSlug: z.string().min(1).max(120).optional(),
    isCovered: z.boolean().nullable().optional(),
    populationMin: z.number().int().min(0).max(20_000_000).optional(),
    populationMax: z.number().int().min(0).max(20_000_000).optional(),
    search: z.string().max(500).optional(),
    sortBy: SortBySchema.optional(),
    sortDir: SortDirSchema.optional(),
  })
  .strict();
const CitySlugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9\-]+$/, "slug doit être [a-z0-9-]");
const MarkPrioritySchema = z.array(CitySlugSchema).min(1).max(5000);
const ExportCsvParamsSchema = z
  .object({
    deptCode: z.string().min(2).max(5).optional(),
    regionSlug: z.string().min(1).max(120).optional(),
    isCovered: z.boolean().nullable().optional(),
  })
  .strict();

export interface CityRow {
  id: string;
  slug: string;
  name: string;
  population: number;
  departmentCode: string;
  departmentName: string;
  regionSlug: string;
  regionName: string;
  populationTier: number;
  priority: number;
  isCovered: boolean;
  articlesCount: number;
  lastArticleAt: Date | null;
  hasEconomicData: boolean;
}

export interface CitiesListResult {
  cities: CityRow[];
  total: number;
  totalPages: number;
}

export interface CitiesStatsResult {
  total: number;
  covered: number;
  uncovered: number;
  coveragePercent: number;
  tier1Total: number;
  tier1Covered: number;
  tier2Total: number;
  tier2Covered: number;
  tier3Total: number;
  tier3Covered: number;
  tier4Total: number;
  tier4Covered: number;
}

export async function listCities(params: {
  page?: number;
  pageSize?: number;
  deptCode?: string;
  regionSlug?: string;
  isCovered?: boolean | null;
  populationMin?: number;
  populationMax?: number;
  search?: string;
  sortBy?: "priority" | "population" | "name" | "articlesCount";
  sortDir?: "asc" | "desc";
}): Promise<CitiesListResult> {
  await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  ListCitiesParamsSchema.parse(params);
  const {
    page = 1,
    pageSize = 50,
    deptCode,
    regionSlug,
    isCovered,
    populationMin,
    populationMax,
    search,
    sortBy = "priority",
    sortDir = "asc",
  } = params;

  const where = {
    isTargeted: true,
    ...(deptCode ? { departmentCode: deptCode } : {}),
    ...(regionSlug ? { regionSlug } : {}),
    ...(isCovered !== null && isCovered !== undefined ? { isCovered } : {}),
    ...(populationMin !== undefined ? { population: { gte: populationMin } } : {}),
    ...(populationMax !== undefined ? { population: { lte: populationMax } } : {}),
    ...(search?.trim() ? { name: { contains: search.trim(), mode: "insensitive" as const } } : {}),
  };

  const [cities, total] = await Promise.all([
    prisma.city.findMany({
      where,
      select: {
        id: true,
        slug: true,
        name: true,
        population: true,
        departmentCode: true,
        departmentName: true,
        regionSlug: true,
        regionName: true,
        populationTier: true,
        priority: true,
        isCovered: true,
        articlesCount: true,
        lastArticleAt: true,
        hasEconomicData: true,
      },
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.city.count({ where }),
  ]);

  return {
    cities: cities as CityRow[],
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getCitiesStats(): Promise<CitiesStatsResult> {
  await requireAdmin();
  const [total, covered] = await Promise.all([
    prisma.city.count({ where: { isTargeted: true } }),
    prisma.city.count({ where: { isTargeted: true, isCovered: true } }),
  ]);

  const tierCounts = await prisma.city.groupBy({
    by: ["populationTier"],
    where: { isTargeted: true },
    _count: { _all: true },
  });

  const tierCoveredCounts = await prisma.city.groupBy({
    by: ["populationTier"],
    where: { isTargeted: true, isCovered: true },
    _count: { _all: true },
  });

  function tierTotal(t: number) {
    return (
      tierCounts.find(
        (r: { populationTier: number; _count: { _all: number } }) => r.populationTier === t,
      )?._count._all ?? 0
    );
  }

  function tierCovered(t: number) {
    return (
      tierCoveredCounts.find(
        (r: { populationTier: number; _count: { _all: number } }) => r.populationTier === t,
      )?._count._all ?? 0
    );
  }

  return {
    total,
    covered,
    uncovered: total - covered,
    coveragePercent: total > 0 ? Math.round((covered / total) * 100 * 10) / 10 : 0,
    tier1Total: tierTotal(1),
    tier1Covered: tierCovered(1),
    tier2Total: tierTotal(2),
    tier2Covered: tierCovered(2),
    tier3Total: tierTotal(3),
    tier3Covered: tierCovered(3),
    tier4Total: tierTotal(4),
    tier4Covered: tierCovered(4),
  };
}

export async function markCitiesPriority(citySlugs: string[]): Promise<{ updated: number }> {
  await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  MarkPrioritySchema.parse(citySlugs);
  const result = await prisma.city.updateMany({
    where: { slug: { in: citySlugs } },
    data: { isTargeted: true },
  });
  return { updated: result.count };
}

/**
 * Synchro complète du sous-système villes (P0 2026-07-03) : seed idempotent de
 * `City` + `CityGenerationOrder` depuis la SSOT statique `VILLES`, puis recompute
 * de la couverture depuis les articles publiés. Déclenchable au runtime (bouton
 * admin) avec la vraie DB, sans accès shell. Idempotente (createMany skipDuplicates
 * + recount autoritaire). Débloque cities-coverage, coverage-map, cities-order.
 */
export async function syncCitiesUniverse(): Promise<{
  citiesInserted: number;
  orderInserted: number;
  universeSize: number;
  coveredCities: number;
}> {
  await requireAdmin();
  return syncCityUniverseAndCoverage();
}

export interface LandingIndexabilityResult {
  byTier: Array<{ tier: number; total: number; indexable: number }>;
  totalCities: number;
  totalIndexable: number;
}

/**
 * Indexabilité des PAGES VILLES statiques (« couche A » landing SEO), par tier,
 * calculée depuis la SSOT statique `VILLES` + `isVilleIndexable` (cap T1/T2 +
 * curées). Distinct de la couverture par ARTICLES content-gen (« couche B »,
 * getCitiesStats). Permet de piloter la stratégie d'indexation par tier.
 */
export async function getLandingIndexabilityByTier(): Promise<LandingIndexabilityResult> {
  await requireAdmin();
  const { VILLES, isVilleIndexable } = await import("@/content/villes");
  const tierOf = (p: number): number => (p >= 100_000 ? 1 : p >= 20_000 ? 2 : p >= 10_000 ? 3 : 4);
  const agg = new Map<number, { total: number; indexable: number }>([
    [1, { total: 0, indexable: 0 }],
    [2, { total: 0, indexable: 0 }],
    [3, { total: 0, indexable: 0 }],
    [4, { total: 0, indexable: 0 }],
  ]);
  let totalIndexable = 0;
  for (const v of VILLES) {
    const e = agg.get(tierOf(v.population))!;
    e.total += 1;
    if (isVilleIndexable(v.slug)) {
      e.indexable += 1;
      totalIndexable += 1;
    }
  }
  return {
    byTier: [1, 2, 3, 4].map((tier) => ({ tier, ...agg.get(tier)! })),
    totalCities: VILLES.length,
    totalIndexable,
  };
}

export async function exportCitiesCSV(params: {
  deptCode?: string;
  regionSlug?: string;
  isCovered?: boolean | null;
}): Promise<string> {
  await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  ExportCsvParamsSchema.parse(params);
  const where = {
    isTargeted: true,
    ...(params.deptCode ? { departmentCode: params.deptCode } : {}),
    ...(params.regionSlug ? { regionSlug: params.regionSlug } : {}),
    ...(params.isCovered !== null && params.isCovered !== undefined
      ? { isCovered: params.isCovered }
      : {}),
  };

  const cities = await prisma.city.findMany({
    where,
    select: {
      slug: true,
      name: true,
      population: true,
      departmentCode: true,
      departmentName: true,
      regionName: true,
      populationTier: true,
      priority: true,
      isCovered: true,
      articlesCount: true,
    },
    orderBy: { priority: "asc" },
  });

  const header = "slug,name,population,dept_code,dept_name,region,tier,priority,covered,articles\n";
  const rows = cities
    .map(
      (c: {
        slug: string;
        name: string;
        population: number;
        departmentCode: string;
        departmentName: string;
        regionName: string;
        populationTier: number;
        priority: number;
        isCovered: boolean;
        articlesCount: number;
      }) =>
        `${c.slug},"${c.name}",${c.population},${c.departmentCode},"${c.departmentName}","${c.regionName}",${c.populationTier},${c.priority},${c.isCovered ? "oui" : "non"},${c.articlesCount}`,
    )
    .join("\n");

  return header + rows;
}
