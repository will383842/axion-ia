/**
 * Content Generator — CRUD CoverageCampaign (admin /coverage, /coverage/new,
 * /coverage/[id]).
 *
 * § 25 master prompt. Création campagne = sélection scope (ville/dépt/région) +
 * volume cible + distribution % + audience mix + intent mix. Le worker
 * `content-orchestrator-worker` (Sprint 4) pick-up `status='running'` et
 * enqueue les jobs ContentGenJob selon distribution.
 */

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { CoverageScope, CoverageStatus } from "../../../../prisma/generated/client";
import { requireAdmin } from "./_auth";

function adminBase(): string {
  return `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/coverage`;
}

export interface CampaignRow {
  readonly id: string;
  readonly name: string;
  readonly status: CoverageStatus;
  readonly scope: CoverageScope;
  readonly totalTargetCount: number;
  readonly generatedCount: number;
  readonly publishedCount: number;
  readonly failedCount: number;
  readonly qualityImprovedCount: number;
  readonly estimatedCostUsd: string | null;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
}

export interface CampaignDetail extends CampaignRow {
  readonly anchorVilleSlugs: ReadonlyArray<string>;
  readonly anchorDepartementCodes: ReadonlyArray<string>;
  readonly anchorRegionSlugs: ReadonlyArray<string>;
  readonly typeDistribution: Record<string, number>;
  readonly audienceMix: Record<string, number>;
  readonly searchIntentMix: Record<string, number> | null;
  readonly estimatedDurationMinutes: number | null;
}

export async function listCampaigns(status?: CoverageStatus): Promise<ReadonlyArray<CampaignRow>> {
  const rows = await prisma.coverageCampaign.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toRow);
}

export async function getCampaign(id: string): Promise<CampaignDetail | null> {
  const r = await prisma.coverageCampaign.findUnique({ where: { id } });
  if (!r) return null;
  return {
    ...toRow(r),
    anchorVilleSlugs: r.anchorVilleSlugs,
    anchorDepartementCodes: r.anchorDepartementCodes,
    anchorRegionSlugs: r.anchorRegionSlugs,
    typeDistribution: r.typeDistribution as Record<string, number>,
    audienceMix: r.audienceMix as Record<string, number>,
    searchIntentMix: r.searchIntentMix as Record<string, number> | null,
    estimatedDurationMinutes: r.estimatedDurationMinutes,
  };
}

function toRow(r: {
  id: string;
  name: string;
  status: CoverageStatus;
  scope: CoverageScope;
  totalTargetCount: number;
  generatedCount: number;
  publishedCount: number;
  failedCount: number;
  qualityImprovedCount: number;
  estimatedCostUsd: unknown;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}): CampaignRow {
  return {
    id: r.id,
    name: r.name,
    status: r.status,
    scope: r.scope,
    totalTargetCount: r.totalTargetCount,
    generatedCount: r.generatedCount,
    publishedCount: r.publishedCount,
    failedCount: r.failedCount,
    qualityImprovedCount: r.qualityImprovedCount,
    estimatedCostUsd: r.estimatedCostUsd ? String(r.estimatedCostUsd) : null,
    startedAt: r.startedAt,
    completedAt: r.completedAt,
    createdAt: r.createdAt,
  };
}

export interface CreateCampaignInput {
  readonly name: string;
  readonly scope: CoverageScope;
  readonly anchorVilleSlugs?: ReadonlyArray<string>;
  readonly anchorDepartementCodes?: ReadonlyArray<string>;
  readonly anchorRegionSlugs?: ReadonlyArray<string>;
  readonly totalTargetCount: number;
  readonly typeDistribution: Record<string, number>;
  readonly audienceMix: Record<string, number>;
  readonly searchIntentMix?: Record<string, number>;
  readonly estimatedCostUsd?: number;
  readonly estimatedDurationMinutes?: number;
}

export async function createCampaign(input: CreateCampaignInput): Promise<string> {
  const session = await requireAdmin();
  if (input.name.length < 3) throw new Error("name_too_short");
  if (input.totalTargetCount < 1 || input.totalTargetCount > 10_000)
    throw new Error("target_count_range");
  const typeSum = Object.values(input.typeDistribution).reduce((a, v) => a + v, 0);
  if (Math.abs(typeSum - 100) > 0.5) throw new Error("type_distribution_must_sum_100");
  const audSum = Object.values(input.audienceMix).reduce((a, v) => a + v, 0);
  if (Math.abs(audSum - 100) > 0.5) throw new Error("audience_mix_must_sum_100");

  const r = await prisma.coverageCampaign.create({
    data: {
      name: input.name,
      status: "draft",
      scope: input.scope,
      anchorVilleSlugs: input.anchorVilleSlugs ? [...input.anchorVilleSlugs] : [],
      anchorDepartementCodes: input.anchorDepartementCodes ? [...input.anchorDepartementCodes] : [],
      anchorRegionSlugs: input.anchorRegionSlugs ? [...input.anchorRegionSlugs] : [],
      totalTargetCount: input.totalTargetCount,
      typeDistribution: input.typeDistribution as never,
      audienceMix: input.audienceMix as never,
      ...(input.searchIntentMix ? { searchIntentMix: input.searchIntentMix as never } : {}),
      estimatedCostUsd: input.estimatedCostUsd ?? null,
      estimatedDurationMinutes: input.estimatedDurationMinutes ?? null,
      createdBy: session.userId,
    },
  });
  revalidatePath(adminBase());
  return r.id;
}

export async function launchCampaign(id: string): Promise<void> {
  await requireAdmin();
  await prisma.coverageCampaign.update({
    where: { id },
    data: { status: "running", startedAt: new Date() },
  });
  revalidatePath(adminBase());
  revalidatePath(`${adminBase()}/${id}`);
}

export async function pauseCampaign(id: string): Promise<void> {
  await requireAdmin();
  await prisma.coverageCampaign.update({
    where: { id },
    data: { status: "paused", pausedAt: new Date() },
  });
  revalidatePath(adminBase());
}

export async function resumeCampaign(id: string): Promise<void> {
  await requireAdmin();
  await prisma.coverageCampaign.update({
    where: { id },
    data: { status: "running", pausedAt: null },
  });
  revalidatePath(adminBase());
}

export async function cancelCampaign(id: string): Promise<void> {
  await requireAdmin();
  await prisma.coverageCampaign.update({
    where: { id },
    data: { status: "cancelled", completedAt: new Date() },
  });
  revalidatePath(adminBase());
}
