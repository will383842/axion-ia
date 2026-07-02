/**
 * Content Generator — Jobs admin actions (admin /jobs, /jobs/[id], /queue).
 *
 * § 12.1 + § 13 master prompt. Lecture filtrée + retry / cancel / duplicate.
 * Le pick-up effectif reste dans le worker (Sprint 1 livré) — ici on
 * manipule la table ContentGenJob.
 */

"use server";

import * as Sentry from "@sentry/nextjs";

import { Queue } from "bullmq";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type {
  ContentGenJobStatus,
  ContentType,
  ServiceSector,
} from "../../../../prisma/generated/client";
import { logActivity } from "@/server/content-gen/shared/activity-log";
import { requireAdmin } from "./_auth";

// Sprint Final P1-3 — Zod runtime validation des inputs Server Actions.
const JobIdSchema = z.string().min(1).max(64);
const ContentGenJobStatusSchema = z.enum([
  "queued",
  "running",
  "needs_review",
  "approved",
  "publishing",
  "published",
  "failed",
  "cancelled",
  "quality_improving",
  "quarantined_critical",
  "quarantined_factcheck",
]);
const ContentTypeSchema = z.enum([
  "landing_ville",
  "blog_article",
  "blog_from_rss",
  "blog_from_keywords",
  "blog_from_title",
  "comparison",
  "guide_pilier",
  "qa_derived",
  "faq_standalone",
]);
const ServiceSectorSchema = z.enum([
  "interventions_formations",
  "audits",
  "implementations",
  "un_a_un",
  "sites_web_augmentes",
]);
const JobsListFiltersSchema = z
  .object({
    status: ContentGenJobStatusSchema.optional(),
    contentType: ContentTypeSchema.optional(),
    templateId: z.string().min(1).max(64).optional(),
    campaignId: z.string().min(1).max(64).optional(),
    serviceSector: ServiceSectorSchema.optional(),
    anchorVilleSlug: z.string().min(1).max(120).optional(),
    search: z.string().max(500).optional(),
    page: z.number().int().min(1).max(100_000).optional(),
  })
  .strict();

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
  // Garde-fou : ne JAMAIS re-enqueuer un job `landing_ville` (CLI-only, hors
  // REGISTRY → le worker lèverait « No generator registered »). Les jobs legacy
  // de ce type restent visibles/filtrables dans l'admin mais ne sont pas rejouables.
  if (dbJob.contentType === "landing_ville") {
    console.warn(
      `[jobs.retry] job ${jobId} de type landing_ville (CLI-only) non re-enqueuable — ignoré`,
    );
    return;
  }
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
  // Sprint Final P1-3 — Zod runtime validation.
  JobsListFiltersSchema.parse(filters);
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
  // Sprint Final P1-3 — Zod runtime validation.
  JobIdSchema.parse(id);
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
  // Sprint Final P1-3 — Zod runtime validation.
  JobIdSchema.parse(id);
  try {
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
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "retryJob" } });
    throw e;
  }
}

export async function cancelJob(id: string): Promise<void> {
  const session = await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  JobIdSchema.parse(id);
  try {
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
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "cancelJob" } });
    throw e;
  }
}

/**
 * Sprint A-suite P6 — Item 2. Compte les jobs en état failed ou quarantined
 * non traités (liés à une campagne). Utilisé par le badge rouge sidebar.
 */
export async function getFailedJobsCount(): Promise<number> {
  return prisma.contentGenJob.count({
    where: {
      status: { in: ["failed", "quarantined_critical", "quarantined_factcheck"] },
      campaignId: { not: null },
    },
  });
}

export async function retryAllFailed(): Promise<number> {
  const session = await requireAdmin();
  try {
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
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "retryAllFailed" } });
    throw e;
  }
}

/**
 * Supprime les jobs en échec/bloqués (nettoyage console — 2026-07-02). Ce sont
 * des tentatives ratées SANS contenu publié. Suppression sûre :
 *  - GenerationLog.jobId + ReviewQueue.jobId sont en onDelete: Cascade (purgés
 *    automatiquement) ;
 *  - Article.generatedByJobId est une simple chaîne (pas de FK) → aucun article
 *    publié n'est impacté.
 * Retourne le nombre de jobs supprimés.
 */
export async function deleteFailedJobs(): Promise<number> {
  const session = await requireAdmin();
  try {
    const res = await prisma.contentGenJob.deleteMany({
      where: {
        status: { in: ["failed", "quarantined_critical", "quarantined_factcheck"] },
      },
    });
    revalidatePath(adminBase());
    await logActivity({
      session,
      action: "content-gen.job.delete-failed-bulk",
      targetType: "ContentGenJob",
      changes: { count: res.count },
    });
    return res.count;
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "deleteFailedJobs" } });
    throw e;
  }
}
