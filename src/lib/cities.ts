/**
 * Helper villes France — Phase A Sprint Perfection 2026-05-22.
 *
 * Fonctions de requête sur la table `cities` (2100 communes ≥ 5000 hab).
 * Stub-aware : retourne [] si DATABASE_URL contient "stub.invalid" (build SSG).
 */

import { prisma } from "@/lib/prisma";

export type City = {
  id: string;
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
  isTargeted: boolean;
  isCovered: boolean;
  articlesCount: number;
  lastArticleAt: Date | null;
  hasEconomicData: boolean;
};

function isStubBuild(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") ?? false;
}

/** Récupère les villes par tier population (1=≥100k, 2=20-100k, 3=10-20k, 4=5-10k). */
export async function getCitiesByPopulationTier(tier: 1 | 2 | 3 | 4): Promise<City[]> {
  if (isStubBuild()) return [];
  return prisma.city.findMany({
    where: { populationTier: tier, isTargeted: true },
    orderBy: { priority: "asc" },
  }) as Promise<City[]>;
}

/** Récupère les N plus grandes villes (par population). */
export async function getTopNCities(n: number): Promise<City[]> {
  if (isStubBuild()) return [];
  return prisma.city.findMany({
    where: { isTargeted: true },
    orderBy: { population: "desc" },
    take: n,
  }) as Promise<City[]>;
}

/** Récupère les villes d'un département (code INSEE). */
export async function getCitiesByDepartment(deptCode: string): Promise<City[]> {
  if (isStubBuild()) return [];
  return prisma.city.findMany({
    where: { departmentCode: deptCode, isTargeted: true },
    orderBy: { population: "desc" },
  }) as Promise<City[]>;
}

/** Recherche fulltext sur le nom (prefix match). */
export async function searchCities(query: string): Promise<City[]> {
  if (isStubBuild() || !query.trim()) return [];
  return prisma.city.findMany({
    where: {
      isTargeted: true,
      name: { contains: query, mode: "insensitive" },
    },
    orderBy: { population: "desc" },
    take: 20,
  }) as Promise<City[]>;
}

/** Villes non encore couvertes par du contenu (pour ciblage campagne automatique). */
export async function getUncoveredCities(limit = 50): Promise<City[]> {
  if (isStubBuild()) return [];
  return prisma.city.findMany({
    where: { isTargeted: true, isCovered: false },
    orderBy: { priority: "asc" },
    take: limit,
  }) as Promise<City[]>;
}

/** Stats couverture globale. */
export async function getCitiesCoverageStats(): Promise<{
  total: number;
  covered: number;
  uncovered: number;
  coveragePercent: number;
  byTier: Record<number, { total: number; covered: number }>;
}> {
  if (isStubBuild()) {
    return {
      total: 0,
      covered: 0,
      uncovered: 0,
      coveragePercent: 0,
      byTier: { 1: { total: 0, covered: 0 }, 2: { total: 0, covered: 0 }, 3: { total: 0, covered: 0 }, 4: { total: 0, covered: 0 } },
    };
  }

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

  const byTier: Record<number, { total: number; covered: number }> = {
    1: { total: 0, covered: 0 },
    2: { total: 0, covered: 0 },
    3: { total: 0, covered: 0 },
    4: { total: 0, covered: 0 },
  };

  for (const row of tierCounts) {
    const t = row.populationTier as 1 | 2 | 3 | 4;
    byTier[t] = { total: row._count._all, covered: 0 };
  }

  for (const row of tierCoveredCounts) {
    const t = row.populationTier as 1 | 2 | 3 | 4;
    if (byTier[t]) byTier[t]!.covered = row._count._all;
  }

  return {
    total,
    covered,
    uncovered: total - covered,
    coveragePercent: total > 0 ? Math.round((covered / total) * 100 * 10) / 10 : 0,
    byTier,
  };
}

/** Récupère les villes avec pagination + filtres (pour console admin). */
export async function listCitiesAdmin(params: {
  page?: number;
  pageSize?: number;
  deptCode?: string;
  regionSlug?: string;
  isCovered?: boolean;
  populationMin?: number;
  populationMax?: number;
  search?: string;
  sortBy?: "priority" | "population" | "name" | "articlesCount";
  sortDir?: "asc" | "desc";
}): Promise<{ cities: City[]; total: number; totalPages: number }> {
  if (isStubBuild()) return { cities: [], total: 0, totalPages: 0 };

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
    ...(isCovered !== undefined ? { isCovered } : {}),
    ...(populationMin !== undefined ? { population: { gte: populationMin } } : {}),
    ...(populationMax !== undefined ? { population: { lte: populationMax } } : {}),
    ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
  };

  const [cities, total] = await Promise.all([
    prisma.city.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.city.count({ where }),
  ]);

  return {
    cities: cities as City[],
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}
