/**
 * Content Generator — Jobs admin actions (admin /jobs, /jobs/[id], /queue).
 *
 * § 12.1 + § 13 master prompt. Lecture filtrée + retry / cancel / duplicate.
 * Le pick-up effectif reste dans le worker (Sprint 1 livré) — ici on
 * manipule la table ContentGenJob.
 */

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ContentGenJobStatus, ContentType } from "../../../../prisma/generated/client";
import { requireAdmin } from "./_auth";

function adminBase(): string {
  return `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/jobs`;
}

export interface JobsListFilters {
  readonly status?: ContentGenJobStatus;
  readonly contentType?: ContentType;
  readonly templateId?: string;
  readonly campaignId?: string;
  readonly anchorVilleSlug?: string;
  readonly search?: string;
  readonly page?: number;
}

export interface JobRow {
  readonly id: string;
  readonly contentType: ContentType;
  readonly status: ContentGenJobStatus;
  readonly priority: number;
  readonly anchorVilleSlug: string | null;
  readonly anchorRegionSlug: string | null;
  readonly templateId: string | null;
  readonly campaignId: string | null;
  readonly qualityScore: number | null;
  readonly seoScore: number | null;
  readonly costUsd: string | null;
  readonly durationMs: number | null;
  readonly errorMessage: string | null;
  readonly createdAt: Date;
}

export interface JobsListResult {
  readonly rows: ReadonlyArray<JobRow>;
  readonly total: number;
  readonly page: number;
  readonly totalPages: number;
}

const PAGE_SIZE = 50;

export async function listJobs(filters: JobsListFilters = {}): Promise<JobsListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const where = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.contentType ? { contentType: filters.contentType } : {}),
    ...(filters.templateId ? { templateId: filters.templateId } : {}),
    ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
    ...(filters.anchorVilleSlug ? { anchorVilleSlug: filters.anchorVilleSlug } : {}),
    ...(filters.search
      ? {
          OR: [
            { id: { contains: filters.search } },
            { anchorVilleSlug: { contains: filters.search.toLowerCase() } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.contentGenJob.count({ where }),
    prisma.contentGenJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  return {
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    rows: rows.map((r) => ({
      id: r.id,
      contentType: r.contentType,
      status: r.status,
      priority: r.priority,
      anchorVilleSlug: r.anchorVilleSlug,
      anchorRegionSlug: r.anchorRegionSlug,
      templateId: r.templateId,
      campaignId: r.campaignId,
      qualityScore: r.qualityScore,
      seoScore: r.seoScore,
      costUsd: r.costUsd ? r.costUsd.toString() : null,
      durationMs: r.durationMs,
      errorMessage: r.errorMessage,
      createdAt: r.createdAt,
    })),
  };
}

export async function getJob(id: string) {
  const r = await prisma.contentGenJob.findUnique({
    where: { id },
    include: {
      template: true,
      logs: { orderBy: { timestamp: "desc" }, take: 100 },
      reviewQueue: true,
    },
  });
  return r;
}

export async function retryJob(id: string): Promise<void> {
  await requireAdmin();
  await prisma.contentGenJob.update({
    where: { id },
    data: { status: "queued", errorMessage: null, retryCount: { increment: 1 } },
  });
  revalidatePath(adminBase());
  revalidatePath(`${adminBase()}/${id}`);
}

export async function cancelJob(id: string): Promise<void> {
  await requireAdmin();
  await prisma.contentGenJob.update({
    where: { id },
    data: {
      status: "cancelled",
      errorMessage: "Annulé manuellement par admin",
      completedAt: new Date(),
    },
  });
  revalidatePath(adminBase());
  revalidatePath(`${adminBase()}/${id}`);
}

export async function retryAllFailed(): Promise<number> {
  await requireAdmin();
  const result = await prisma.contentGenJob.updateMany({
    where: { status: "failed" },
    data: { status: "queued", errorMessage: null },
  });
  revalidatePath(adminBase());
  return result.count;
}
