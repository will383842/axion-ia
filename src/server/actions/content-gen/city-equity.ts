"use server";

import { prisma } from "@/lib/prisma";

export interface CityEquityRow {
  readonly villeSlug: string;
  readonly totalJobs: number;
  readonly completedJobs: number;
  readonly publishedArticles: number;
  readonly byVertical: Partial<Record<string, number>>;
}

export interface CityEquityData {
  readonly rows: ReadonlyArray<CityEquityRow>;
  readonly totalCities: number;
  readonly avgPublished: number;
  readonly maxPublished: number;
  readonly wellCovered: number; // cities with >= TARGET
}

const EQUITY_TARGET = 10; // articles publiés minimum par ville pour "bien couverte"

/**
 * Retourne le nombre d'articles publiés par ville (anchorVilleSlug).
 * Utilisé par le wizard campagne pour afficher l'équité géographique.
 */
export async function getCityEquityData(): Promise<CityEquityData> {
  // Grouper ContentGenJob par villeSlug + serviceSector pour l'equity
  const jobGroups = await prisma.contentGenJob
    .groupBy({
      by: ["anchorVilleSlug", "status"],
      where: { anchorVilleSlug: { not: null } },
      _count: { id: true },
    })
    .catch(
      () => [] as Array<{ anchorVilleSlug: string | null; status: string; _count: { id: number } }>,
    );

  // Compter les articles publiés (outputBlogPostId non null = article créé)
  const publishedByVille = await prisma.contentGenJob
    .groupBy({
      by: ["anchorVilleSlug"],
      where: {
        anchorVilleSlug: { not: null },
        outputBlogPostId: { not: null },
      },
      _count: { id: true },
    })
    .catch(() => [] as Array<{ anchorVilleSlug: string | null; _count: { id: number } }>);

  // Construire la map ville → counts
  const totalMap: Record<string, number> = {};
  const completedMap: Record<string, number> = {};

  for (const g of jobGroups) {
    if (!g.anchorVilleSlug) continue;
    totalMap[g.anchorVilleSlug] = (totalMap[g.anchorVilleSlug] ?? 0) + g._count.id;
    if (g.status === "completed") {
      completedMap[g.anchorVilleSlug] = (completedMap[g.anchorVilleSlug] ?? 0) + g._count.id;
    }
  }

  const publishedMap: Record<string, number> = {};
  for (const p of publishedByVille) {
    if (!p.anchorVilleSlug) continue;
    publishedMap[p.anchorVilleSlug] = p._count.id;
  }

  const allSlugs = new Set([...Object.keys(totalMap), ...Object.keys(publishedMap)]);

  const rows: CityEquityRow[] = [...allSlugs].map((slug) => ({
    villeSlug: slug,
    totalJobs: totalMap[slug] ?? 0,
    completedJobs: completedMap[slug] ?? 0,
    publishedArticles: publishedMap[slug] ?? 0,
    byVertical: {},
  }));

  rows.sort((a, b) => b.publishedArticles - a.publishedArticles);

  const totalCities = rows.length;
  const avgPublished =
    totalCities > 0
      ? Math.round(rows.reduce((s, r) => s + r.publishedArticles, 0) / totalCities)
      : 0;
  const maxPublished = rows[0]?.publishedArticles ?? 0;
  const wellCovered = rows.filter((r) => r.publishedArticles >= EQUITY_TARGET).length;

  return { rows, totalCities, avgPublished, maxPublished, wellCovered };
}

// EQUITY_TARGET non exporté — "use server" n'autorise que les fonctions async en export
// La valeur est utilisée uniquement en interne. Les composants client utilisent
// wellCovered du résultat de getCityEquityData() pour afficher la progression.
