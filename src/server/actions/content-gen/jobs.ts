/**
 * Content Generator — Jobs admin actions (admin /jobs, /jobs/[id], /queue).
 *
 * § 12.1 + § 13 master prompt. Lecture filtrée + retry / cancel / duplicate.
 * Le pick-up effectif reste dans le worker (Sprint 1 livré) — ici on
 * manipule la table ContentGenJob.
 */

"use server";

import { Queue } from "bullmq";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type {
  ContentGenJobStatus,
  ContentType,
  ServiceSector,
} from "../../../../prisma/generated/client";
import { logActivity } from "@/server/content-gen/shared/activity-log";
import { requireAdmin } from "./_auth";

function adminBase(): string {
  return `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/jobs`;
}

// Lazy singleton Queue (évite ouverture connexion Redis quand pas appelé)
let contentGenQueue: Queue | null = null;
function getContentGenQueue(): Queue | null {
  if (contentGenQueue) return contentGenQueue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  contentGenQueue = new Queue("content-gen", { connection: { url: redisUrl } });
  return contentGenQueue;
}

/**
 * Re-enqueue un ContentGenJob dans BullMQ avec son payload original.
 * Idempotent : BullMQ jobId `gen-${id}` empêche les doublons (si le worker
 * traite déjà ce job, la 2nde add() no-op).
 */
async function enqueueGenJob(jobId: string): Promise<void> {
  const queue = getContentGenQueue();
  if (!queue) {
    console.warn(`[jobs.retry] REDIS_URL absent — job ${jobId} re-enqueue skipped`);
    return;
  }
  const dbJob = await prisma.contentGenJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      contentType: true,
      targetSearchIntent: true,
      inputPayload: true,
    },
  });
  if (!dbJob) return;
  await queue.add(
    "generate",
    {
      contentGenJobId: dbJob.id,
      contentType: dbJob.contentType,
      targetSearchIntent: dbJob.targetSearchIntent,
      inputPayload: dbJob.inputPayload as Record<string, unknown>,
    },
    { jobId: `gen-${dbJob.id}` },
  );
}

export interface JobsListFilters {
  readonly status?: ContentGenJobStatus;
  readonly contentType?: ContentType;
  readonly templateId?: string;
  readonly campaignId?: string;
  readonly serviceSector?: ServiceSector;
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
  readonly serviceSector: ServiceSector | null;
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
    // Filtre secteur indirect via la relation campaign. Jobs orphelins
    // (landing direct ou RSS) sont exclus quand un secteur est filtré.
    ...(filters.serviceSector
      ? { campaign: { is: { serviceSector: filters.serviceSector } } }
      : {}),
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
      include: { campaign: { select: { serviceSector: true } } },
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
      serviceSector: r.campaign?.serviceSector ?? null,
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
  const session = await requireAdmin();
  await prisma.contentGenJob.update({
    where: { id },
    data: {
      status: "queued",
      errorMessage: null,
      retryCount: { increment: 1 },
      completedAt: null,
      startedAt: null,
    },
  });
  // P0-7 fix : re-enqueue BullMQ immédiatement. Sans cet appel, le job restait
  // zombie (status=queued en DB sans worker pour le picker → bloqué).
  await enqueueGenJob(id);
  revalidatePath(adminBase());
  revalidatePath(`${adminBase()}/${id}`);
  await logActivity({
    session,
    action: "content-gen.job.retry",
    targetType: "ContentGenJob",
    targetId: id,
  });
}

export async function cancelJob(id: string): Promise<void> {
  const session = await requireAdmin();
  await prisma.contentGenJob.update({
    where: { id },
    data: {
      status: "cancelled",
      errorMessage: "Annulé manuellement par admin",
      completedAt: new Date(),
    },
  });
  // Best-effort : si un job BullMQ est encore waiting/delayed, on le purge.
  const queue = getContentGenQueue();
  if (queue) {
    try {
      const bullJob = await queue.getJob(`gen-${id}`);
      if (bullJob) await bullJob.remove();
    } catch {
      // Le job est peut-être en cours (active) — laisse le worker finir.
    }
  }
  revalidatePath(adminBase());
  revalidatePath(`${adminBase()}/${id}`);
  await logActivity({
    session,
    action: "content-gen.job.cancel",
    targetType: "ContentGenJob",
    targetId: id,
  });
}

export async function retryAllFailed(): Promise<number> {
  const session = await requireAdmin();
  const failed = await prisma.contentGenJob.findMany({
    where: { status: "failed" },
    select: { id: true },
    take: 500, // cap raisonnable pour éviter saturation BullMQ d'un coup
  });
  if (failed.length === 0) {
    revalidatePath(adminBase());
    return 0;
  }
  await prisma.contentGenJob.updateMany({
    where: { id: { in: failed.map((f) => f.id) } },
    data: {
      status: "queued",
      errorMessage: null,
      completedAt: null,
      startedAt: null,
      retryCount: { increment: 1 },
    },
  });
  // P0-7 fix : re-enqueue chaque job en BullMQ. updateMany seul laissait les
  // jobs zombies (DB queued sans worker pick).
  for (const f of failed) {
    await enqueueGenJob(f.id);
  }
  revalidatePath(adminBase());
  await logActivity({
    session,
    action: "content-gen.job.retry-bulk",
    targetType: "ContentGenJob",
    changes: { count: failed.length },
  });
  return failed.length;
}
