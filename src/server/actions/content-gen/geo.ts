/**
 * Content Generator — Geo stats (§ 15).
 *
 * Agrégations rapides pour cockpit : par région, par dépt, par ville. Lecture
 * pure. Pas de mutation ici — les batches sont gérés via une table batch
 * dédiée Sprint 4 (V1 = trigger ad-hoc depuis dashboard).
 */

"use server";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import type { ContentGenJobStatus } from "../../../../prisma/generated/client";
import { prisma } from "@/lib/prisma";
import { REGIONS } from "@/content/regions";
import { VILLES_CORE } from "@/content/villes/core";
import { requireAdmin } from "./_auth";
import { readContentGenConfig } from "./_settings";

// Sprint Final P1-3 — Zod runtime validation des inputs Server Actions.
const GetJobsVilleSectorDetailSchema = z
  .object({
    limit: z.number().int().min(1).max(5000),
    filterStatus: z.string().min(1).max(60).optional(),
    filterVille: z.string().min(1).max(120).optional(),
    offset: z.number().int().min(0).max(1_000_000),
    sortBy: z.enum(["count", "score", "ville"]),
    sortDir: z.enum(["asc", "desc"]),
  })
  .strict();

export interface RegionGeoStat {
  readonly slug: string;
  readonly name: string;
  readonly publicationPhase: number;
  readonly publishedJobs: number;
  readonly runningJobs: number;
  readonly failedJobs: number;
  readonly pendingReviewJobs: number;
}

const REGION_BY_VILLE: ReadonlyMap<string, string> = new Map(
  VILLES_CORE.map((v) => [v.slug, v.region] as const),
);

/**
 * Région d'ancrage d'un job qui ne porte qu'une ville.
 *
 * Privée au module : ce fichier est `"use server"`, où tout export doit être
 * une fonction asynchrone (Gate B du 2026-09-02 : « Server Actions must be
 * async functions »).
 */
function regionOfVille(villeSlug: string | null | undefined): string | null {
  if (!villeSlug) return null;
  return REGION_BY_VILLE.get(villeSlug) ?? null;
}

export async function listRegionGeoStats(): Promise<ReadonlyArray<RegionGeoStat>> {
  await requireAdmin(); // Pass B fix P0-4
  // 🔴 2026-09-02 — le cockpit géo affichait 0 partout (« 0 contenu publié »
  // en tête, 18 régions à 0/0/0/0) à côté d'un KPI « Publiés total 258 ».
  // Les jobs ne portent que `anchorVilleSlug` : `anchorRegionSlug` n'est écrit
  // que pour une campagne à `anchorRegionSlugs`, ce qu'aucune campagne prod
  // n'a. La région se DÉRIVE donc de la ville quand elle n'est pas portée.
  const grouped = await prisma.contentGenJob.groupBy({
    by: ["anchorRegionSlug", "anchorVilleSlug", "status"],
    _count: { _all: true },
    where: { OR: [{ anchorRegionSlug: { not: null } }, { anchorVilleSlug: { not: null } }] },
  });
  const byRegion = new Map<string, Record<string, number>>();
  for (const row of grouped) {
    const region = row.anchorRegionSlug ?? regionOfVille(row.anchorVilleSlug);
    if (!region) continue;
    const map = byRegion.get(region) ?? {};
    map[row.status] = (map[row.status] ?? 0) + row._count._all;
    byRegion.set(region, map);
  }
  return REGIONS.map((r) => {
    const stats = byRegion.get(r.slug) ?? {};
    return {
      slug: r.slug,
      name: r.nameFr,
      publicationPhase: r.publicationPhase,
      publishedJobs: stats.published ?? 0,
      runningJobs: (stats.running ?? 0) + (stats.queued ?? 0) + (stats.quality_improving ?? 0),
      failedJobs: stats.failed ?? 0,
      pendingReviewJobs: stats.needs_review ?? 0,
    };
  });
}

export interface GlobalGeoStats {
  readonly totalRegions: number;
  readonly publishedJobs: number;
  readonly runningJobs: number;
  readonly failedJobs: number;
  readonly pendingReviewJobs: number;
  readonly velocity7dJobs: number;
}

export interface CostsStats {
  readonly thirtyDaysAgo: Date;
  readonly sevenDaysAgo: Date;
  readonly startOfMonth: Date;
  readonly byProvider: ReadonlyArray<{
    readonly provider: string;
    readonly costUsd: number;
    readonly tokensInput: number;
    readonly tokensOutput: number;
  }>;
  readonly totalMonthUsd: number;
  readonly total7dUsd: number;
  readonly providers: ReadonlyArray<{
    readonly provider: string;
    readonly monthlyCapUsd: number;
  }>;
}

export async function getCostsStats(): Promise<CostsStats> {
  try {
    await requireAdmin(); // Pass B fix P0-4
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    const [byProvider30d, totalMonth, total7d, providers] = await Promise.all([
      prisma.costLedger.groupBy({
        by: ["provider"],
        _sum: { costUsd: true, tokensInput: true, tokensOutput: true },
        where: { timestamp: { gte: thirtyDaysAgo } },
      }),
      prisma.costLedger.aggregate({
        _sum: { costUsd: true },
        where: { timestamp: { gte: startOfMonth } },
      }),
      prisma.costLedger.aggregate({
        _sum: { costUsd: true },
        where: { timestamp: { gte: sevenDaysAgo } },
      }),
      prisma.providerConfig.findMany(),
    ]);
    return {
      thirtyDaysAgo,
      sevenDaysAgo,
      startOfMonth,
      byProvider: byProvider30d.map((p) => ({
        provider: p.provider,
        costUsd: p._sum.costUsd ? Number(p._sum.costUsd) : 0,
        tokensInput: p._sum.tokensInput ?? 0,
        tokensOutput: p._sum.tokensOutput ?? 0,
      })),
      totalMonthUsd: totalMonth._sum.costUsd ? Number(totalMonth._sum.costUsd) : 0,
      total7dUsd: total7d._sum.costUsd ? Number(total7d._sum.costUsd) : 0,
      providers: providers.map((p) => ({
        provider: p.provider,
        monthlyCapUsd: Number(p.monthlyCapUsd),
      })),
    };
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "getCostsStats" } });
    throw e;
  }
}

export interface OrchestratorStats {
  readonly activeCampaigns: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly scope: string;
    readonly status: string;
    readonly totalTargetCount: number;
    readonly generatedCount: number;
    readonly velocity7d: number;
    readonly etaDays: number | null;
  }>;
  readonly dailyPlanJobs24h: number;
  readonly totalActiveTarget: number;
  readonly totalActiveGenerated: number;
}

export async function getOrchestratorStats(): Promise<OrchestratorStats> {
  await requireAdmin(); // Pass B fix P0-4
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [activeCampaigns, dailyPlan] = await Promise.all([
    prisma.coverageCampaign.findMany({
      // 2026-09-02 — sans `archivedAt: null`, le tableau de bord annonçait
      // « 5 actives » (2 en cours + 3 en pause ARCHIVÉES) contre 2 partout
      // ailleurs. `listCampaigns` respecte l'archivage ; ce compteur aussi.
      where: { status: { in: ["running", "paused"] }, archivedAt: null },
      orderBy: { createdAt: "desc" },
    }),
    prisma.contentGenJob.count({
      where: { createdAt: { gte: oneDayAgo } },
    }),
  ]);

  // Velocity per campaign (jobs published last 7d)
  const velocityRows =
    activeCampaigns.length > 0
      ? await prisma.contentGenJob.groupBy({
          by: ["campaignId"],
          _count: { _all: true },
          where: {
            campaignId: { in: activeCampaigns.map((c) => c.id) },
            status: "published",
            completedAt: { gte: sevenDaysAgo },
          },
        })
      : [];
  const velocityMap = new Map(velocityRows.map((r) => [r.campaignId, r._count._all]));

  return {
    activeCampaigns: activeCampaigns.map((c) => {
      const velocity7d = velocityMap.get(c.id) ?? 0;
      const remaining = c.totalTargetCount - c.generatedCount;
      const etaDays =
        velocity7d > 0 && remaining > 0 ? Math.ceil(remaining / (velocity7d / 7)) : null;
      return {
        id: c.id,
        name: c.name,
        scope: c.scope,
        status: c.status,
        totalTargetCount: c.totalTargetCount,
        generatedCount: c.generatedCount,
        velocity7d,
        etaDays,
      };
    }),
    dailyPlanJobs24h: dailyPlan,
    totalActiveTarget: activeCampaigns.reduce((a, c) => a + c.totalTargetCount, 0),
    totalActiveGenerated: activeCampaigns.reduce((a, c) => a + c.generatedCount, 0),
  };
}

export async function getGlobalGeoStats(): Promise<GlobalGeoStats> {
  await requireAdmin(); // Pass B fix P0-4
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [published, running, failed, review, velocity] = await Promise.all([
    prisma.contentGenJob.count({ where: { status: "published" } }),
    prisma.contentGenJob.count({
      where: {
        status: { in: ["running", "queued", "quality_improving"] },
      },
    }),
    prisma.contentGenJob.count({ where: { status: "failed" } }),
    prisma.contentGenJob.count({ where: { status: "needs_review" } }),
    prisma.contentGenJob.count({
      where: { status: "published", completedAt: { gte: sevenDaysAgo } },
    }),
  ]);
  return {
    totalRegions: REGIONS.length,
    publishedJobs: published,
    runningJobs: running,
    failedJobs: failed,
    pendingReviewJobs: review,
    velocity7dJobs: velocity,
  };
}
export interface VilleSectorRow {
  readonly anchorVilleSlug: string;
  readonly serviceSector: string | null;
  readonly status: string;
  readonly count: number;
  readonly avgQuality: number | null;
}

export async function getJobsVilleSectorDetail(
  limit = 200,
  filterStatus?: string,
  filterVille?: string,
  offset = 0,
  sortBy: "count" | "score" | "ville" = "count",
  sortDir: "asc" | "desc" = "desc",
): Promise<ReadonlyArray<VilleSectorRow>> {
  try {
    await requireAdmin();
    // Sprint Final P1-3 — Zod runtime validation.
    GetJobsVilleSectorDetailSchema.parse({
      limit,
      filterStatus,
      filterVille,
      offset,
      sortBy,
      sortDir,
    });
    // serviceSector is on CoverageCampaign, not ContentGenJob.
    // We group by (ville, campaignId, status) then batch-join campaign sectors.
    const orderBy =
      sortBy === "score"
        ? { _avg: { qualityScore: sortDir } }
        : sortBy === "ville"
          ? { anchorVilleSlug: sortDir }
          : { _count: { anchorVilleSlug: sortDir } };
    const grouped = await prisma.contentGenJob.groupBy({
      by: ["anchorVilleSlug", "campaignId", "status"],
      _count: { anchorVilleSlug: true },
      _avg: { qualityScore: true },
      where: {
        anchorVilleSlug: filterVille ? { equals: filterVille } : { not: null },
        ...(filterStatus ? { status: { equals: filterStatus as ContentGenJobStatus } } : {}),
      },
      orderBy,
      take: limit,
      skip: offset,
    });

    // Batch-fetch sectors from campaigns
    const campaignIds = [...new Set(grouped.map((r) => r.campaignId).filter(Boolean))] as string[];
    const campaigns =
      campaignIds.length > 0
        ? await prisma.coverageCampaign.findMany({
            where: { id: { in: campaignIds } },
            select: { id: true, serviceSector: true },
          })
        : [];
    const sectorMap = new Map(campaigns.map((c) => [c.id, c.serviceSector as string | null]));

    return grouped.map((row) => ({
      anchorVilleSlug: row.anchorVilleSlug ?? "",
      serviceSector: row.campaignId ? (sectorMap.get(row.campaignId) ?? null) : null,
      status: row.status,
      count: row._count.anchorVilleSlug,
      avgQuality: row._avg?.qualityScore ?? null,
    }));
  } catch (e) {
    Sentry.captureException(e, {
      tags: { area: "content-gen", action: "getJobsVilleSectorDetail" },
    });
    throw e;
  }
}

export interface CityCoverageProgress {
  readonly publishedVilles: number;
  readonly targetVilles: number;
  readonly pct: number;
}

/** Nombre de villes distinctes avec au moins 1 article publié (pour barre de progression 39/120). */
export async function getCityCoverageProgress(): Promise<CityCoverageProgress> {
  await requireAdmin();
  // P0 A-02 — TARGET_VILLES vient de ContentGenConfig (clé `target_villes`).
  // Fallback à 120 si non configuré en DB (stub.invalid short-circuit → null via proxy → default).
  const TARGET_VILLES = await readContentGenConfig<number>("target_villes", 120);
  const grouped = await prisma.contentGenJob.groupBy({
    by: ["anchorVilleSlug"],
    where: { anchorVilleSlug: { not: null }, status: "published" },
  });
  const publishedVilles = grouped.length;
  return {
    publishedVilles,
    targetVilles: TARGET_VILLES,
    pct: TARGET_VILLES > 0 ? Math.round((publishedVilles / TARGET_VILLES) * 100) : 0,
  };
}
