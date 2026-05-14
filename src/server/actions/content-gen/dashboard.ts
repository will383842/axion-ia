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
    prisma.contentGenJob.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.contentGenJob.count({
      where: { status: "published", completedAt: { gte: sevenDaysAgo } },
    }),
    prisma.contentGenJob.count({
      where: { status: "failed", completedAt: { gte: sevenDaysAgo } },
    }),
    prisma.reviewQueue.count({ where: { status: "pending" } }),
    prisma.costLedger.aggregate({
      _sum: { costUsd: true },
      where: { timestamp: { gte: sevenDaysAgo } },
    }),
    prisma.contentGenJob.aggregate({
      _avg: { qualityScore: true },
      where: { qualityScore: { not: null }, completedAt: { gte: sevenDaysAgo } },
    }),
    prisma.generationLog.count({
      where: {
        step: "plagiarism_check",
        level: "warn",
        timestamp: { gte: sevenDaysAgo },
      },
    }),
    prisma.contentGenJob.count({ where: { status: "running" } }),
    prisma.contentGenJob.count({ where: { status: "queued" } }),
    prisma.contentGenJob.count({ where: { status: "failed" } }),
    prisma.knowledgeEntry.count({ where: { status: "published" } }).catch(() => 0),
    getKillSwitch(),
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
