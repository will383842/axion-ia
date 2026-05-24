/**
 * Content Generator — Coverage map server action (Sprint v7 Phase 2 commit 2).
 *
 * Agrège la couverture éditoriale par ville en 3 buckets distincts (D13
 * prompt v7) — editorial / landings / RSS — et roll-up par département pour
 * la carte FR heatmap.
 *
 * Source unique de vérité : `cityGenerationOrder` (universe 2150 villes) +
 * `contentGenJob` filtré status='published' groupé par (anchorVilleSlug,
 * contentType) — pattern cohérent avec cities-order.ts et city-equity.ts.
 *
 * Performance : 1 groupBy global + 1 findMany cityGenerationOrder + agrégation
 * JS Map. Pas de N+1 (vs 2150 × 3 queries si on bouclait sur getCoverageStats).
 */

"use server";

import { z } from "zod";

import { prisma } from "@/lib/prisma";

import { requireAdmin } from "./_auth";

// ─── Bucket ContentType (cohérent avec cities-order.ts) ─────────────────────

const EDITORIAL_CONTENT_TYPES = new Set<string>([
  "blog_article",
  "blog_from_keywords",
  "blog_from_title",
  "comparison",
  "guide_pilier",
  "qa_derived",
  "faq_standalone",
]);
const LANDING_CONTENT_TYPE = "landing_ville";
const RSS_CONTENT_TYPE = "blog_from_rss";

// ─── Zod ────────────────────────────────────────────────────────────────────

const FiltersSchema = z
  .object({
    regionSlug: z.string().min(1).max(64).optional(),
    deptCode: z.string().min(1).max(8).optional(),
    tier: z.enum(["T1", "T2", "T3", "T4"]).optional(),
    pipeline: z.enum(["all", "editorial", "landings", "rss", "combined"]).optional(),
  })
  .strict();

const OptsSchema = z.object({ filters: FiltersSchema.optional() }).strict();

// ─── Types publics ──────────────────────────────────────────────────────────

export interface CoverageMapCityRow {
  readonly rank: number;
  readonly villeSlug: string;
  readonly pop: number;
  readonly regionSlug: string;
  readonly deptCode: string;
  readonly tier: string;
  readonly pinned: boolean;
  readonly editorialCount: number;
  readonly landingCount: number;
  readonly rssCount: number;
  /** Pourcentage couverture global (0..100). Définition v7 : editorial≥10 = ~10%, landings & rss ajoutent bonus. */
  readonly coveragePct: number;
  readonly status: "complete" | "in_progress" | "idle";
}

export interface CoverageMapDeptRow {
  readonly deptCode: string;
  readonly regionSlug: string;
  readonly totalCities: number;
  readonly coveredCities: number;
  readonly coveragePct: number;
  /** Estimé en jours pour compléter au rythme actuel (placeholder V1 : null). */
  readonly etaDays: number | null;
}

export interface CoverageMapNationalStats {
  readonly totalCities: number;
  readonly coveredCities: number;
  readonly coveragePct: number;
  /** Nombre de villes ≥ 50% couverture. */
  readonly citiesAbove50: number;
  /** Nombre de villes 100% (editorial + landing + rss tous présents). */
  readonly complete: number;
}

export interface CoverageMapData {
  readonly nationalStats: CoverageMapNationalStats;
  readonly byDept: ReadonlyArray<CoverageMapDeptRow>;
  readonly byCity: ReadonlyArray<CoverageMapCityRow>;
}

// ─── Helpers internes ───────────────────────────────────────────────────────

/**
 * Définition v7 du pourcentage couverture global d'une ville :
 *   - editorial ≥ 10 articles = 60 pts
 *   - landing_ville présent = 25 pts
 *   - blog_from_rss ≥ 1 = 15 pts (pilote uniquement, sinon non applicable)
 * Total 100. Cap à 100.
 */
function computeCityCoveragePct(
  editorial: number,
  landings: number,
  rss: number,
  isRssEligible: boolean,
): number {
  const editorialPts = Math.min(60, editorial * 6);
  const landingPts = landings > 0 ? 25 : 0;
  const rssMaxPts = isRssEligible ? 15 : 0;
  const rssPts = isRssEligible && rss > 0 ? rssMaxPts : 0;
  // Si non éligible RSS, on rebase sur 85 → multiplie par 100/85 pour ne pas pénaliser.
  const denominator = isRssEligible ? 100 : 100 - 15;
  const raw = editorialPts + landingPts + rssPts;
  return Math.min(100, Math.round((raw / denominator) * 100));
}

function statusOf(
  editorial: number,
  landings: number,
  rss: number,
): "complete" | "in_progress" | "idle" {
  if (editorial > 0 && landings > 0) return rss > 0 ? "complete" : "complete";
  if (editorial > 0 || landings > 0 || rss > 0) return "in_progress";
  return "idle";
}

// ─── Action ─────────────────────────────────────────────────────────────────

export async function getCoverageMapData(rawOpts?: unknown): Promise<CoverageMapData> {
  await requireAdmin();
  const parsed = rawOpts === undefined ? {} : OptsSchema.parse(rawOpts);
  const filters = parsed.filters ?? {};

  // 1. Univers villes (CityGenerationOrder = source vérité 2150 villes)
  const cityWhere = {
    ...(filters.regionSlug ? { regionSlug: filters.regionSlug } : {}),
    ...(filters.deptCode ? { deptCode: filters.deptCode } : {}),
    ...(filters.tier ? { tier: filters.tier } : {}),
  };
  const allCities = await prisma.cityGenerationOrder.findMany({
    where: cityWhere,
    orderBy: [{ pinned: "desc" }, { rank: "asc" }],
  });

  // 2. Agrège counts en 1 groupBy global (anchorVilleSlug + contentType)
  const grouped = await prisma.contentGenJob.groupBy({
    by: ["anchorVilleSlug", "contentType"],
    where: { status: "published", anchorVilleSlug: { not: null } },
    _count: { _all: true },
  });

  // 3. Bucketing JS → Map<villeSlug, {editorial, landings, rss}>
  const cityCounts = new Map<string, { editorial: number; landings: number; rss: number }>();
  for (const g of grouped) {
    if (!g.anchorVilleSlug) continue;
    const entry = cityCounts.get(g.anchorVilleSlug) ?? { editorial: 0, landings: 0, rss: 0 };
    const ct = String(g.contentType);
    const n = g._count?._all ?? 0;
    if (EDITORIAL_CONTENT_TYPES.has(ct)) entry.editorial += n;
    else if (ct === LANDING_CONTENT_TYPE) entry.landings = n;
    else if (ct === RSS_CONTENT_TYPE) entry.rss = n;
    cityCounts.set(g.anchorVilleSlug, entry);
  }

  // 4. Build byCity
  const byCity: CoverageMapCityRow[] = allCities.map((c) => {
    const counts = cityCounts.get(c.villeSlug) ?? { editorial: 0, landings: 0, rss: 0 };
    // Tier 1+2 = "pilotes RSS éligibles" (heuristique simplifiée v1)
    const isRssEligible = c.tier === "T1" || c.tier === "T2";
    const coveragePct = computeCityCoveragePct(
      counts.editorial,
      counts.landings,
      counts.rss,
      isRssEligible,
    );
    return {
      rank: c.rank,
      villeSlug: c.villeSlug,
      pop: c.pop,
      regionSlug: c.regionSlug,
      deptCode: c.deptCode,
      tier: c.tier,
      pinned: c.pinned,
      editorialCount: counts.editorial,
      landingCount: counts.landings,
      rssCount: counts.rss,
      coveragePct,
      status: statusOf(counts.editorial, counts.landings, counts.rss),
    };
  });

  // 5. Filtre Pipeline (UI level — on garde la ligne mais on peut filtrer pour byDept calc)
  const filteredForStats =
    filters.pipeline === "editorial"
      ? byCity.filter((c) => c.editorialCount > 0)
      : filters.pipeline === "landings"
        ? byCity.filter((c) => c.landingCount > 0)
        : filters.pipeline === "rss"
          ? byCity.filter((c) => c.rssCount > 0)
          : filters.pipeline === "combined"
            ? byCity.filter((c) => c.editorialCount > 0 && c.landingCount > 0)
            : byCity;

  // 6. Build byDept (groupe villes par deptCode)
  const deptMap = new Map<
    string,
    { regionSlug: string; total: number; covered: number; pctSum: number }
  >();
  for (const c of byCity) {
    const entry = deptMap.get(c.deptCode) ?? {
      regionSlug: c.regionSlug,
      total: 0,
      covered: 0,
      pctSum: 0,
    };
    entry.total += 1;
    if (c.status !== "idle") entry.covered += 1;
    entry.pctSum += c.coveragePct;
    deptMap.set(c.deptCode, entry);
  }
  const byDept: CoverageMapDeptRow[] = Array.from(deptMap.entries())
    .map(([deptCode, e]) => ({
      deptCode,
      regionSlug: e.regionSlug,
      totalCities: e.total,
      coveredCities: e.covered,
      coveragePct: e.total > 0 ? Math.round(e.pctSum / e.total) : 0,
      etaDays: null,
    }))
    .sort((a, b) => a.deptCode.localeCompare(b.deptCode));

  // 7. National stats (toujours sur byCity sans filtre pipeline)
  const totalCities = byCity.length;
  const coveredCities = byCity.filter((c) => c.status !== "idle").length;
  const citiesAbove50 = byCity.filter((c) => c.coveragePct >= 50).length;
  const complete = byCity.filter((c) => c.status === "complete").length;
  const nationalStats: CoverageMapNationalStats = {
    totalCities,
    coveredCities,
    coveragePct: totalCities > 0 ? Math.round((coveredCities / totalCities) * 100) : 0,
    citiesAbove50,
    complete,
  };

  return {
    nationalStats,
    byDept,
    byCity: filteredForStats,
  };
}
