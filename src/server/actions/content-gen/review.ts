/**
 * Content Generator — Review queue actions (admin /review-queue, /publications-status).
 *
 * § 14 master prompt — workflow tier-2 → tier-1 par Will. Approve / Reject /
 * Re-generate / Promote. Le worker `content-publish-worker` (Sprint 4) lit
 * `ReviewQueue.status='approved'` pour appliquer la promotion (writeArticle
 * + revalidatePath + IndexNow ping).
 */

"use server";

import { Queue } from "bullmq";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ReviewStatus } from "../../../../prisma/generated/client";
import { requireAdmin } from "./_auth";

function adminBase(): string {
  return `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/review-queue`;
}

let publishQueue: Queue | null = null;
function getPublishQueue(): Queue | null {
  if (publishQueue) return publishQueue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  publishQueue = new Queue("content-publish", { connection: { url: redisUrl } });
  return publishQueue;
}

async function enqueuePublish(reviewQueueId: string, promoteToTier1: boolean): Promise<void> {
  const queue = getPublishQueue();
  if (!queue) {
    // Dev sans Redis : on log et on continue (l'opération admin reste atomique
    // côté DB ; le worker pickera quand Redis sera up).
    console.warn(
      `[review] publish queue indisponible (REDIS_URL absent) — review ${reviewQueueId} promote=${promoteToTier1} non enqueued.`,
    );
    return;
  }
  await queue.add(
    "publish",
    { reviewQueueId, promoteToTier1 },
    { jobId: `publish-${reviewQueueId}` },
  );
}

export interface ReviewRow {
  readonly id: string;
  readonly jobId: string;
  readonly status: ReviewStatus;
  readonly reviewedBy: string | null;
  readonly reviewNotes: string | null;
  readonly reviewedAt: Date | null;
  readonly promotedToTier1At: Date | null;
  readonly createdAt: Date;
  readonly jobContentType: string;
  readonly jobAnchorVille: string | null;
  readonly jobQualityScore: number | null;
  readonly jobSeoScore: number | null;
}

export async function listReview(status?: ReviewStatus): Promise<ReadonlyArray<ReviewRow>> {
  const where = status ? { status } : {};
  const rows = await prisma.reviewQueue.findMany({
    where,
    include: { job: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map((r) => ({
    id: r.id,
    jobId: r.jobId,
    status: r.status,
    reviewedBy: r.reviewedBy,
    reviewNotes: r.reviewNotes,
    reviewedAt: r.reviewedAt,
    promotedToTier1At: r.promotedToTier1At,
    createdAt: r.createdAt,
    jobContentType: r.job.contentType,
    jobAnchorVille: r.job.anchorVilleSlug,
    jobQualityScore: r.job.qualityScore,
    jobSeoScore: r.job.seoScore,
  }));
}

export async function approveReview(id: string, notes?: string): Promise<void> {
  const session = await requireAdmin();
  await prisma.reviewQueue.update({
    where: { id },
    data: {
      status: "approved",
      reviewedBy: session.userId,
      reviewNotes: notes ?? null,
      reviewedAt: new Date(),
    },
  });
  // Enqueue publish-worker (tier-2 noindex_follow par défaut).
  await enqueuePublish(id, false);
  revalidatePath(adminBase());
}

export async function rejectReview(id: string, notes: string): Promise<void> {
  const session = await requireAdmin();
  if (notes.trim().length < 5) throw new Error("notes_required");
  await prisma.reviewQueue.update({
    where: { id },
    data: {
      status: "rejected",
      reviewedBy: session.userId,
      reviewNotes: notes,
      reviewedAt: new Date(),
    },
  });
  revalidatePath(adminBase());
}

export async function promoteToTier1(id: string): Promise<void> {
  const session = await requireAdmin();
  await prisma.reviewQueue.update({
    where: { id },
    data: {
      status: "promoted_t1",
      reviewedBy: session.userId,
      reviewedAt: new Date(),
      promotedToTier1At: new Date(),
    },
  });
  // Bascule ContentGenJob → status `publishing` (transitionnel — le worker
  // publish met à jour `published` une fois l'Article inséré DB).
  const review = await prisma.reviewQueue.findUnique({ where: { id }, select: { jobId: true } });
  if (review) {
    await prisma.contentGenJob.update({
      where: { id: review.jobId },
      data: { status: "publishing" },
    });
  }
  // Enqueue publish-worker en mode tier-1 indexable.
  await enqueuePublish(id, true);
  revalidatePath(adminBase());
}
