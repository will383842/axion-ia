/**
 * Server action — Matrice équité villes × types de contenus.
 *
 * Retourne un pivot ville → { type: count } pour détecter les déséquilibres
 * géographiques ou par type de contenu entre les villes cibles.
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./_auth";

const FiltersSchema = z
  .object({
    campaignId: z.string().min(1).max(64).optional(),
    tier: z.number().int().min(1).max(4).optional(),
  })
  .strict();

export interface CityEquityRow {
  readonly citySlug: string;
  /** Alias de citySlug — compatibilité CoverageWizardClient. */
  readonly villeSlug: string;
  readonly cityName: string;
  readonly tier: number;
  readonly byType: Record<string, number>;
  readonly total: number;
  /** Articles publiés (status=published) toutes campagnes confondues. */
  readonly publishedArticles: number;
  /** true si au moins un type présent dans la matrice est absent pour cette ville */
  readonly hasGap: boolean;
}

export interface CityEquityMatrix {
  readonly rows: ReadonlyArray<CityEquityRow>;
  readonly contentTypes: ReadonlyArray<string>;
  readonly totalByType: Record<string, number>;
  readonly avgPerCity: number;
  readonly gapCitiesCount: number;
}

export async function getCityContentEquityMatrix(filters?: {
  readonly campaignId?: string;
  readonly tier?: number;
}): Promise<CityEquityMatrix> {
  await requireAdmin();
  if (filters) FiltersSchema.parse(filters);

  const grouped = await prisma.contentGenJob.groupBy({
    by: ["anchorVilleSlug", "contentType"],
    where: {
      anchorVilleSlug: { not: null },
      status: { not: "cancelled" },
      ...(filters?.campaignId ? { campaignId: filters.campaignId } : {}),
    },
    _count: { _all: true },
    orderBy: { anchorVilleSlug: "asc" },
  });

  // Articles publiés par ville (pour publishedArticles)
  const publishedByCity = await prisma.contentGenJob.groupBy({
    by: ["anchorVilleSlug"],
    where: {
      anchorVilleSlug: { not: null },
      status: "published",
      ...(filters?.campaignId ? { campaignId: filters.campaignId } : {}),
    },
    _count: { _all: true },
  });
  const publishedMap = new Map(
    publishedByCity
      .filter((r) => r.anchorVilleSlug !== null)
      .map((r) => [r.anchorVilleSlug!, r._count._all]),
  );

  const citySlugs = [...new Set(grouped.map((r) => r.anchorVilleSlug!))];
  const cities = await prisma.city.findMany({
    where: {
      slug: { in: citySlugs },
      ...(filters?.tier !== undefined ? { populationTier: filters.tier } : {}),
    },
    select: { slug: true, name: true, populationTier: true },
  });
  const cityMap = new Map(cities.map((c) => [c.slug, c]));
  // Défensif (P0 2026-07-03) : n'applique le filtre tier QUE si la table `City`
  // renvoie des lignes. Table vide (non seedée) → filtre bypassé (affiche les
  // jobs live) au lieu de tout masquer.
  const slugsInTier =
    filters?.tier !== undefined && cityMap.size > 0 ? new Set(cityMap.keys()) : null;

  const rowMap = new Map<string, { byType: Record<string, number>; total: number }>();
  const contentTypes = new Set<string>();

  for (const row of grouped) {
    const slug = row.anchorVilleSlug!;
    if (slugsInTier && !slugsInTier.has(slug)) continue;
    const type = row.contentType as string;
    contentTypes.add(type);
    if (!rowMap.has(slug)) rowMap.set(slug, { byType: {}, total: 0 });
    const entry = rowMap.get(slug)!;
    entry.byType[type] = row._count._all;
    entry.total += row._count._all;
  }

  const sortedTypes = [...contentTypes].sort();

  const rows: CityEquityRow[] = [...rowMap.entries()]
    .map(([slug, entry]) => {
      const city = cityMap.get(slug);
      const hasGap = sortedTypes.some((t) => (entry.byType[t] ?? 0) === 0);
      return {
        citySlug: slug,
        villeSlug: slug,
        cityName: city?.name ?? slug,
        tier: city?.populationTier ?? 0,
        byType: entry.byType,
        total: entry.total,
        publishedArticles: publishedMap.get(slug) ?? 0,
        hasGap,
      };
    })
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      return b.total - a.total;
    });

  const totalByType: Record<string, number> = {};
  for (const type of sortedTypes) {
    totalByType[type] = rows.reduce((sum, r) => sum + (r.byType[type] ?? 0), 0);
  }

  const avgPerCity = rows.length > 0 ? rows.reduce((s, r) => s + r.total, 0) / rows.length : 0;
  const gapCitiesCount = rows.filter((r) => r.hasGap).length;

  return { rows, contentTypes: sortedTypes, totalByType, avgPerCity, gapCitiesCount };
}

/**
 * Version simplifiée utilisée par CoverageWizardClient pour afficher
 * le nombre d'articles publiés par ville dans l'étape géo du wizard.
 */
export async function getCityEquityData(): Promise<ReadonlyArray<CityEquityRow>> {
  await requireAdmin();

  const publishedByCity = await prisma.contentGenJob.groupBy({
    by: ["anchorVilleSlug"],
    where: { anchorVilleSlug: { not: null }, status: "published" },
    _count: { _all: true },
  });

  if (publishedByCity.length === 0) return [];

  const citySlugs = publishedByCity
    .filter((r) => r.anchorVilleSlug !== null)
    .map((r) => r.anchorVilleSlug!);
  const cities = await prisma.city.findMany({
    where: { slug: { in: citySlugs } },
    select: { slug: true, name: true, populationTier: true },
  });
  const cityMap = new Map(cities.map((c) => [c.slug, c]));

  return publishedByCity
    .filter((r) => r.anchorVilleSlug !== null)
    .map((r) => {
      const slug = r.anchorVilleSlug!;
      const city = cityMap.get(slug);
      return {
        citySlug: slug,
        villeSlug: slug,
        cityName: city?.name ?? slug,
        tier: city?.populationTier ?? 0,
        byType: {},
        total: r._count._all,
        publishedArticles: r._count._all,
        hasGap: false,
      };
    });
}

export interface ContentTypeEquitySummary {
  readonly contentType: string;
  readonly totalJobs: number;
  readonly citiesWithType: number;
  readonly citiesWithoutType: number;
  readonly minPerCity: number;
  readonly maxPerCity: number;
  readonly avgPerCity: number;
}

/** Stats par type de contenu : répartition géographique (min/max/avg par ville). */
export async function getContentTypeEquitySummary(
  campaignId?: string,
): Promise<ReadonlyArray<ContentTypeEquitySummary>> {
  await requireAdmin();
  if (campaignId !== undefined) z.string().min(1).max(64).parse(campaignId);

  const grouped = await prisma.contentGenJob.groupBy({
    by: ["anchorVilleSlug", "contentType"],
    where: {
      anchorVilleSlug: { not: null },
      status: { not: "cancelled" },
      ...(campaignId ? { campaignId } : {}),
    },
    _count: { _all: true },
  });

  const byType = new Map<string, number[]>();
  for (const row of grouped) {
    if (!row.anchorVilleSlug) continue;
    const type = row.contentType as string;
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type)!.push(row._count._all);
  }

  const totalCities = new Set(grouped.map((r) => r.anchorVilleSlug).filter(Boolean)).size;

  return [...byType.entries()]
    .map(([contentType, counts]) => {
      const totalJobs = counts.reduce((s, c) => s + c, 0);
      const citiesWithType = counts.length;
      const citiesWithoutType = Math.max(0, totalCities - citiesWithType);
      const minPerCity = counts.length > 0 ? Math.min(...counts) : 0;
      const maxPerCity = counts.length > 0 ? Math.max(...counts) : 0;
      const avgPerCity = citiesWithType > 0 ? totalJobs / citiesWithType : 0;
      return {
        contentType,
        totalJobs,
        citiesWithType,
        citiesWithoutType,
        minPerCity,
        maxPerCity,
        avgPerCity,
      };
    })
    .sort((a, b) => b.totalJobs - a.totalJobs);
}
