/**
 * Content Generator — KPIs dashboard (admin /content-gen).
 *
 * § 12.2 master prompt. Lecture pure agrégations sur 7 jours glissants +
 * snapshot KB health + état queue (BullMQ via Prisma car BullMQ stocke
 * dans Redis — V1 on lit la table `ContentGenJob.status`).
 */

"use server";

import { prisma } from "@/lib/prisma";
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
