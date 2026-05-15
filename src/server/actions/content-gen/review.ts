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
import { logActivity } from "@/server/content-gen/shared/activity-log";
import { requireAdmin } from "./_auth";
import { ReviewAlreadyTransitionedError } from "./review-errors";

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

/**
 * Pagine la review queue (Fix P2-2 audit opérationnel 2026-05-14).
 *
 * `take=200` historique limitait l'overview. On garde le default mais avec
 * skip/total pour permettre une pagination côté UI. Sans param `page`,
 * comportement identique à V1 (premiers 200).
 */
export interface ListReviewResult {
  readonly rows: ReadonlyArray<ReviewRow>;
  readonly total: number;
  readonly page: number;
  readonly totalPages: number;
}

const REVIEW_PAGE_SIZE = 50;

export async function listReviewPaginated(
  status?: ReviewStatus,
  page: number = 1,
): Promise<ListReviewResult> {
  const where = status ? { status } : {};
  const p = Math.max(1, page);
  const [total, rows] = await Promise.all([
    prisma.reviewQueue.count({ where }),
    prisma.reviewQueue.findMany({
      where,
      include: { job: true },
      orderBy: { createdAt: "desc" },
      skip: (p - 1) * REVIEW_PAGE_SIZE,
      take: REVIEW_PAGE_SIZE,
    }),
  ]);
  return {
    total,
    page: p,
    totalPages: Math.max(1, Math.ceil(total / REVIEW_PAGE_SIZE)),
    rows: rows.map((r) => ({
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
    })),
  };
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

// `ReviewAlreadyTransitionedError` déplacée dans `./review-errors.ts` car
// Next.js 16+ interdit l'export de symboles non-async dans "use server".

async function readReviewStatus(id: string): Promise<ReviewStatus | undefined> {
  const row = await prisma.reviewQueue.findUnique({
    where: { id },
    select: { status: true },
  });
  return row?.status;
}

export async function approveReview(id: string, notes?: string): Promise<void> {
  const session = await requireAdmin();
  // P1-C fix audit 2026-05-15 — `updateMany` atomique avec status='pending'
  // évite l'override d'une review déjà-approuvée par un autre admin (race).
  const result = await prisma.reviewQueue.updateMany({
    where: { id, status: "pending" },
    data: {
      status: "approved",
      reviewedBy: session.userId,
      reviewNotes: notes ?? null,
      reviewedAt: new Date(),
    },
  });
  if (result.count === 0) {
    throw new ReviewAlreadyTransitionedError(await readReviewStatus(id));
  }
  // Enqueue publish-worker (tier-2 noindex_follow par défaut).
  await enqueuePublish(id, false);
  await logActivity({
    session,
    action: "content-gen.review.approve",
    targetType: "ReviewQueue",
    targetId: id,
    changes: { transition: "pending→approved", notes: notes ?? null },
  });
  revalidatePath(adminBase());
}

/**
 * Bulk approve reviews (P1-12 fix audit opérationnel 2026-05-14).
 *
 * § 12.1 master prompt v1.8 — "Bulk approve : score >= 75 (modifiable admin)".
 * Approuve toutes les reviews pending dont le qualityScore associé au job
 * dépasse `minScore` (défaut 75). Enqueue publish-worker en cascade pour
 * chacune.
 */
export async function bulkApproveReviews(
  minScore: number = 75,
  limit: number = 100,
): Promise<{ approved: number }> {
  const session = await requireAdmin();
  if (minScore < 0 || minScore > 100) throw new Error("score_range");
  if (limit < 1 || limit > 500) throw new Error("limit_range");
  const candidates = await prisma.reviewQueue.findMany({
    where: {
      status: "pending",
      job: { qualityScore: { gte: minScore } },
    },
    include: { job: { select: { id: true } } },
    take: limit,
  });
  for (const r of candidates) {
    await prisma.reviewQueue.update({
      where: { id: r.id },
      data: {
        status: "approved",
        reviewedBy: session.userId,
        reviewNotes: `[bulk approve] score >= ${minScore}`,
        reviewedAt: new Date(),
      },
    });
    await enqueuePublish(r.id, false);
  }
  await logActivity({
    session,
    action: "content-gen.review.bulk-approve",
    targetType: "ReviewQueue",
    changes: { minScore, count: candidates.length },
  });
  revalidatePath(adminBase());
  return { approved: candidates.length };
}

/**
 * Bulk reject reviews (P1-12) — score < maxScore.
 */
export async function bulkRejectReviews(
  maxScore: number = 50,
  limit: number = 100,
): Promise<{ rejected: number }> {
  const session = await requireAdmin();
  if (maxScore < 0 || maxScore > 100) throw new Error("score_range");
  if (limit < 1 || limit > 500) throw new Error("limit_range");
  const candidates = await prisma.reviewQueue.findMany({
    where: {
      status: "pending",
      job: { qualityScore: { lt: maxScore } },
    },
    take: limit,
    select: { id: true },
  });
  if (candidates.length === 0) return { rejected: 0 };
  await prisma.reviewQueue.updateMany({
    where: { id: { in: candidates.map((c) => c.id) } },
    data: {
      status: "rejected",
      reviewedBy: session.userId,
      reviewNotes: `[bulk reject] score < ${maxScore}`,
      reviewedAt: new Date(),
    },
  });
  await logActivity({
    session,
    action: "content-gen.review.bulk-reject",
    targetType: "ReviewQueue",
    changes: { maxScore, count: candidates.length },
  });
  revalidatePath(adminBase());
  return { rejected: candidates.length };
}

export async function rejectReview(id: string, notes: string): Promise<void> {
  const session = await requireAdmin();
  if (notes.trim().length < 5) throw new Error("notes_required");
  // P1-C fix audit 2026-05-15 — race atomique (idem approveReview).
  const result = await prisma.reviewQueue.updateMany({
    where: { id, status: "pending" },
    data: {
      status: "rejected",
      reviewedBy: session.userId,
      reviewNotes: notes,
      reviewedAt: new Date(),
    },
  });
  if (result.count === 0) {
    throw new ReviewAlreadyTransitionedError(await readReviewStatus(id));
  }
  await logActivity({
    session,
    action: "content-gen.review.reject",
    targetType: "ReviewQueue",
    targetId: id,
    changes: { transition: "pending→rejected", notesLen: notes.length },
  });
  revalidatePath(adminBase());
}

/**
 * Demande de modifications sur une review (P1-14 fix audit opérationnel 2026-05-14).
 *
 * Will fournit un commentaire (≥ 10 chars) qui sert de guidance pour le worker
 * `content-quality-improver` au prochain pick. Bascule la review en
 * `needs_edits` (status enum jusque-là orphelin) et le ContentGenJob en
 * `quality_improving` (le worker picke ce statut).
 *
 * V1 = la guidance Will est stockée en `reviewNotes` mais pas encore
 * re-prompted vers le LLM (skeleton). V1.5+ = le quality-improver consomme
 * `reviewNotes` comme system prompt enrichi pour re-générer les sections.
 */
export async function requestEdits(id: string, comment: string): Promise<void> {
  const session = await requireAdmin();
  if (comment.trim().length < 10) throw new Error("comment_required");

  const review = await prisma.reviewQueue.findUnique({
    where: { id },
    select: { jobId: true, status: true },
  });
  if (!review) throw new Error("review_not_found");
  if (review.status !== "pending") throw new Error("review_not_pending");

  await prisma.$transaction([
    prisma.reviewQueue.update({
      where: { id },
      data: {
        status: "needs_edits",
        reviewedBy: session.userId,
        reviewNotes: comment.slice(0, 5000),
        reviewedAt: new Date(),
      },
    }),
    prisma.contentGenJob.update({
      where: { id: review.jobId },
      data: { status: "quality_improving" },
    }),
  ]);
  await logActivity({
    session,
    action: "content-gen.review.request-edits",
    targetType: "ReviewQueue",
    targetId: id,
    changes: { transition: "pending→needs_edits", commentLen: comment.length },
  });
  revalidatePath(adminBase());
}

export async function promoteToTier1(id: string): Promise<void> {
  const session = await requireAdmin();
  // P1-C fix audit 2026-05-15 — promote autorisé depuis `pending` (skip approve)
  // ou `approved` (déjà passé par tier-2). Ne pas autoriser depuis rejected /
  // needs_edits / promoted_t1.
  const result = await prisma.reviewQueue.updateMany({
    where: { id, status: { in: ["pending", "approved"] } },
    data: {
      status: "promoted_t1",
      reviewedBy: session.userId,
      reviewedAt: new Date(),
      promotedToTier1At: new Date(),
    },
  });
  if (result.count === 0) {
    throw new ReviewAlreadyTransitionedError(await readReviewStatus(id));
  }
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
  await logActivity({
    session,
    action: "content-gen.review.promote-tier1",
    targetType: "ReviewQueue",
    targetId: id,
    changes: { promoted: true },
  });
  revalidatePath(adminBase());
}
