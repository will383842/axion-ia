/**
 * Content Generator — KPIs dashboard (admin /content-gen).
 *
 * § 12.2 master prompt. Lecture pure agrégations sur 7 jours glissants +
 * snapshot KB health + état queue (BullMQ via Prisma car BullMQ stocke
 * dans Redis — V1 on lit la table `ContentGenJob.status`).
 */

"use server";

import { prisma } from "@/lib/prisma";
import type { ServiceSector } from "../../../../prisma/generated/client";
import { requireAdmin } from "./_auth";
import { getKillSwitch } from "./kill-switch";

export interface DashboardKpis {
  readonly jobsRun7d: number;
  readonly published7d: number;
  readonly failed7d: number;
  readonly pendingReview: number;
  readonly costSpent7dUsd: number;
  readonly avgQualityScore7d: number | null;
  readonly plagiarismBlocks7d: number;
  readonly activeQueue: {
    readonly running: number;
    readonly waiting: number;
    readonly failed: number;
  };
  readonly kbHealth: { readonly chunks: number; readonly lastIngestAgoDays: number | null };
  readonly killSwitchActive: boolean;
}

/**
 * Wrapper anti-P2021 : Prisma jette `P2021` quand la table n'existe pas
 * (migration `add_content_gen_core` pas appliquée — bloqueur Will). Ce
 * helper retourne `fallback` au lieu de propager l'erreur, ce qui évite que
 * la page admin crash full-page (cf. P1-18 audit opérationnel 2026-05-14).
 */
async function safeCount<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2021") {
      return fallback;
    }
    if (err instanceof Error && err.constructor.name === "PrismaClientInitializationError") {
      return fallback;
    }
    throw err;
  }
}

export async function getDashboardKpis(): Promise<DashboardKpis> {
  // Pass B fix P0-4 — RBAC : aucune lecture KPIs sans session admin (sinon
  // server action POST publiquement appelable expose coûts + scores qualité +
  // stats opérationnelles).
  await requireAdmin();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    jobsRun,
    published,
    failed,
    pendingReview,
    aggCost,
    aggQuality,
    plagBlocks,
    running,
    waiting,
    failedActive,
    kbCount,
    killState,
  ] = await Promise.all([
    safeCount(prisma.contentGenJob.count({ where: { createdAt: { gte: sevenDaysAgo } } }), 0),
    safeCount(
      prisma.contentGenJob.count({
        where: { status: "published", completedAt: { gte: sevenDaysAgo } },
      }),
      0,
    ),
    safeCount(
      prisma.contentGenJob.count({
        where: { status: "failed", completedAt: { gte: sevenDaysAgo } },
      }),
      0,
    ),
    safeCount(prisma.reviewQueue.count({ where: { status: "pending" } }), 0),
    safeCount(
      prisma.costLedger.aggregate({
        _sum: { costUsd: true },
        where: { timestamp: { gte: sevenDaysAgo } },
      }),
      { _sum: { costUsd: null as unknown as null } },
    ),
    safeCount(
      prisma.contentGenJob.aggregate({
        _avg: { qualityScore: true },
        where: { qualityScore: { not: null }, completedAt: { gte: sevenDaysAgo } },
      }),
      { _avg: { qualityScore: null as unknown as null } },
    ),
    safeCount(
      prisma.generationLog.count({
        where: {
          step: "plagiarism_check",
          level: "warn",
          timestamp: { gte: sevenDaysAgo },
        },
      }),
      0,
    ),
    safeCount(prisma.contentGenJob.count({ where: { status: "running" } }), 0),
    safeCount(prisma.contentGenJob.count({ where: { status: "queued" } }), 0),
    safeCount(prisma.contentGenJob.count({ where: { status: "failed" } }), 0),
    safeCount(prisma.knowledgeEntry.count({ where: { status: "published" } }), 0),
    getKillSwitch().catch(() => ({ active: false })),
  ]);

  return {
    jobsRun7d: jobsRun,
    published7d: published,
    failed7d: failed,
    pendingReview,
    costSpent7dUsd: aggCost._sum.costUsd ? Number(aggCost._sum.costUsd) : 0,
    avgQualityScore7d: aggQuality._avg.qualityScore ? Number(aggQuality._avg.qualityScore) : null,
    plagiarismBlocks7d: plagBlocks,
    activeQueue: { running, waiting, failed: failedActive },
    kbHealth: { chunks: kbCount, lastIngestAgoDays: null },
    killSwitchActive: killState.active,
  };
}

/**
 * Rollup ContentGenJob aujourd'hui par secteur cabinet + landing + RSS
 * (§ 25.3 — 2026-05-16). Affiché en tête du dashboard pour piloter le mix
 * d'un coup d'œil. Fenêtre = depuis minuit (heure serveur UTC).
 */
export interface SectorTodayCard {
  readonly key:
    | "interventions_formations"
    | "audits"
    | "implementations"
    | "un_a_un"
    | "sites_web_augmentes"
    | "landing_ville"
    | "blog_from_rss";
  readonly label: string;
  readonly generatedToday: number;
  readonly publishedToday: number;
  readonly failedToday: number;
  readonly campaignsActive: number;
}

export interface SectorBreakdownResult {
  readonly cards: ReadonlyArray<SectorTodayCard>;
  readonly windowStart: Date;
}

export async function getSectorBreakdownToday(): Promise<SectorBreakdownResult> {
  await requireAdmin();

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  const sectors: ReadonlyArray<ServiceSector> = [
    "interventions_formations",
    "audits",
    "implementations",
    "un_a_un",
    "sites_web_augmentes",
  ];
  const sectorLabels: Record<ServiceSector, string> = {
    interventions_formations: "Interventions & Formations",
    audits: "Audits",
    implementations: "Implementations",
    un_a_un: "Coaching 1-to-1",
    sites_web_augmentes: "Sites web augmentes",
  };

  // Pour chaque secteur, on compte les jobs via campaign.serviceSector.
  // Pour landing_ville et blog_from_rss, on compte directement contentType.
  const editorialCards = await Promise.all(
    sectors.map(async (s): Promise<SectorTodayCard> => {
      const [gen, pub, fail, camps] = await Promise.all([
        safeCount(
          prisma.contentGenJob.count({
            where: {
              createdAt: { gte: start },
              campaign: { is: { serviceSector: s } },
            },
          }),
          0,
        ),
        safeCount(
          prisma.contentGenJob.count({
            where: {
              status: "published",
              completedAt: { gte: start },
              campaign: { is: { serviceSector: s } },
            },
          }),
          0,
        ),
        safeCount(
          prisma.contentGenJob.count({
            where: {
              status: "failed",
              completedAt: { gte: start },
              campaign: { is: { serviceSector: s } },
            },
          }),
          0,
        ),
        safeCount(
          prisma.coverageCampaign.count({
            where: { serviceSector: s, status: "running" },
          }),
          0,
        ),
      ]);
      return {
        key: s,
        label: sectorLabels[s],
        generatedToday: gen,
        publishedToday: pub,
        failedToday: fail,
        campaignsActive: camps,
      };
    }),
  );

  // Landing villes (pipeline indépendant — campaign peut être null ou non, on
  // compte par contentType=landing_ville).
  const [landingGen, landingPub, landingFail] = await Promise.all([
    safeCount(
      prisma.contentGenJob.count({
        where: { contentType: "landing_ville", createdAt: { gte: start } },
      }),
      0,
    ),
    safeCount(
      prisma.contentGenJob.count({
        where: {
          contentType: "landing_ville",
          status: "published",
          completedAt: { gte: start },
        },
      }),
      0,
    ),
    safeCount(
      prisma.contentGenJob.count({
        where: {
          contentType: "landing_ville",
          status: "failed",
          completedAt: { gte: start },
        },
      }),
      0,
    ),
  ]);

  // RSS (pipeline indépendant — campaign typiquement null).
  const [rssGen, rssPub, rssFail] = await Promise.all([
    safeCount(
      prisma.contentGenJob.count({
        where: { contentType: "blog_from_rss", createdAt: { gte: start } },
      }),
      0,
    ),
    safeCount(
      prisma.contentGenJob.count({
        where: {
          contentType: "blog_from_rss",
          status: "published",
          completedAt: { gte: start },
        },
      }),
      0,
    ),
    safeCount(
      prisma.contentGenJob.count({
        where: {
          contentType: "blog_from_rss",
          status: "failed",
          completedAt: { gte: start },
        },
      }),
      0,
    ),
  ]);

  const cards: ReadonlyArray<SectorTodayCard> = [
    ...editorialCards,
    {
      key: "landing_ville",
      label: "Landing villes (pipeline indép.)",
      generatedToday: landingGen,
      publishedToday: landingPub,
      failedToday: landingFail,
      campaignsActive: 0,
    },
    {
      key: "blog_from_rss",
      label: "Actualités RSS (pipeline indép.)",
      generatedToday: rssGen,
      publishedToday: rssPub,
      failedToday: rssFail,
      campaignsActive: 0,
    },
  ];

  return { cards, windowStart: start };
}
