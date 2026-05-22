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

import { prisma } from "@/lib/prisma";

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
  const result = await prisma.city.updateMany({
    where: { slug: { in: citySlugs } },
    data: { isTargeted: true },
  });
  return { updated: result.count };
}

export async function exportCitiesCSV(params: {
  deptCode?: string;
  regionSlug?: string;
  isCovered?: boolean | null;
}): Promise<string> {
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
