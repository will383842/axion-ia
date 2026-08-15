/**
 * Content Generator — Review queue actions (admin /review-queue, /publications-status).
 *
 * § 14 master prompt — workflow tier-2 → tier-1 par Will. Approve / Reject /
 * Re-generate / Promote. Le worker `content-publish-worker` (Sprint 4) lit
 * `ReviewQueue.status='approved'` pour appliquer la promotion (writeArticle
 * + revalidatePath + IndexNow ping).
 */

"use server";

import * as Sentry from "@sentry/nextjs";

import { Queue } from "bullmq";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { ReviewStatus } from "../../../../prisma/generated/client";
import { logActivity } from "@/server/content-gen/shared/activity-log";
// Fix 2026-08-15 (audit e2e) — options par défaut partagées : sans elles, les
// files ad-hoc créées ici héritaient du défaut BullMQ (1 seule tentative).
import { CONTENT_GEN_JOB_OPTIONS } from "@/server/content-gen/queue/job-options";
// Fix 2026-08-15 (audit e2e, E4) — motif anti-zombie : jamais d'`add` sur une
// clé squattée par un job terminé, jamais de `remove` sur un job en vol.
import { resolveReenqueueAction } from "@/server/content-gen/queue/reenqueue-policy";
// Audit UX 2026-08-01 — colonne « Titre » sur la file de relecture (même
// source que la liste des jobs, cf. docblock `extractJobTitle`).
import { extractJobTitle } from "@/server/content-gen/shared/admin-labels";
import { requireAdmin } from "./_auth";
import { ReviewAlreadyTransitionedError } from "./review-errors";

// Sprint Final P1-3 — Zod runtime validation des inputs Server Actions.
const ReviewIdSchema = z.string().min(1).max(64);
const ReviewStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "needs_edits",
  "promoted_t1",
]);
const ReviewNotesOptionalSchema = z.string().max(5000).optional();
const ReviewNotesRequiredSchema = z.string().min(1).max(5000);
const ReviewPageSchema = z.number().int().min(1).max(100_000);
const ScoreSchema = z.number().min(0).max(100);
const LimitSchema = z.number().int().min(1).max(500);

function adminBase(): string {
  return `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/review-queue`;
}

let publishQueue: Queue | null = null;
function getPublishQueue(): Queue | null {
  if (publishQueue) return publishQueue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  // Fix 2026-08-15 (audit e2e) — `defaultJobOptions` partagées (retries + backoff),
  // sinon défaut BullMQ = 1 tentative et un kill switch fait échouer définitivement.
  publishQueue = new Queue("content-publish", {
    connection: { url: redisUrl },
    defaultJobOptions: CONTENT_GEN_JOB_OPTIONS,
  });
  return publishQueue;
}

// Fix 2026-08-15 (audit e2e, E4) — file de la boucle qualité. `requestEdits`
// posait le statut `quality_improving` sans JAMAIS rien enfiler ici (le seul
// producteur était le gen-worker) : chaque « Demander des modifications »
// strandait donc le job à vie. Même motif lazy-singleton que ci-dessus.
let improverQueue: Queue | null = null;
function getImproverQueue(): Queue | null {
  if (improverQueue) return improverQueue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  improverQueue = new Queue("content-quality-improver", {
    connection: { url: redisUrl },
    defaultJobOptions: CONTENT_GEN_JOB_OPTIONS,
  });
  return improverQueue;
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
  /** Titre du contenu (extrait de `job.outputJsonRaw.title`) — audit UX 2026-08-01. */
  readonly jobTitle: string | null;
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
  // Fix 2026-08-15 (audit e2e, E5) — "use server" fait de chaque export un
  // endpoint POST public : sans garde, la file de relecture (contenus non
  // publiés inclus) était lisible par un appelant non authentifié.
  await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  if (status !== undefined) ReviewStatusSchema.parse(status);
  ReviewPageSchema.parse(page);
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
      jobTitle: extractJobTitle(r.job.outputJsonRaw),
    })),
  };
}

export async function listReview(status?: ReviewStatus): Promise<ReadonlyArray<ReviewRow>> {
  // Fix 2026-08-15 (audit e2e, E5) — endpoint POST public sans garde sinon.
  await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  if (status !== undefined) ReviewStatusSchema.parse(status);
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
    jobTitle: extractJobTitle(r.job.outputJsonRaw),
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
  // Sprint Final P1-3 — Zod runtime validation.
  ReviewIdSchema.parse(id);
  ReviewNotesOptionalSchema.parse(notes);
  // P1-C fix audit 2026-05-15 — `updateMany` atomique avec status='pending'
  // évite l'override d'une review déjà-approuvée par un autre admin (race).
  try {
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
    // 2026-06-16 (décision Will « tout contenu publié doit être indexé ») —
    // l'approbation manuelle publie en tier-1 INDEXABLE (sitemap + IndexNow),
    // pas en tier-2 noindex. L'approbation humaine vaut feu vert d'indexation.
    await enqueuePublish(id, true);
    await logActivity({
      session,
      action: "content-gen.review.approve",
      targetType: "ReviewQueue",
      targetId: id,
      changes: { transition: "pending→approved", notes: notes ?? null },
    });
    revalidatePath(adminBase());
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "approveReview" } });
    throw e;
  }
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
  try {
    // Sprint Final P1-3 — Zod runtime validation (structurel) avant checks métier.
    ScoreSchema.parse(minScore);
    LimitSchema.parse(limit);
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
    // Fix 2026-08-15 (audit e2e, E9) — isolation par item (motif déjà appliqué à
    // `retryAllFailed`) : avant, une exception à l'item k laissait la revue k
    // `approved` SANS job publish ET interrompait k+1..N. On isole chaque item,
    // on approuve de façon atomique (filtre `status: "pending"` — une revue déjà
    // transitionnée par un autre admin est simplement sautée), et on retourne le
    // compte RÉEL d'approbations, pas le nombre de candidats.
    let approved = 0;
    const failures: string[] = [];
    for (const r of candidates) {
      try {
        const res = await prisma.reviewQueue.updateMany({
          where: { id: r.id, status: "pending" },
          data: {
            status: "approved",
            reviewedBy: session.userId,
            reviewNotes: `[bulk approve] score >= ${minScore}`,
            reviewedAt: new Date(),
          },
        });
        if (res.count === 0) continue; // déjà transitionnée entre-temps
        approved++;
        await enqueuePublish(r.id, true); // tout publié = indexé (tier-1), cf. approveReview
      } catch (e) {
        // Une revue approuvée dont l'enqueue a échoué reste `approved` en DB —
        // rattrapable via « Approuver + rendre visible » (promoteToTier1).
        failures.push(r.id);
        Sentry.captureException(e, {
          tags: { area: "content-gen", action: "bulkApproveReviews.item" },
          extra: { reviewQueueId: r.id },
        });
      }
    }
    if (failures.length > 0) {
      console.warn(
        `[review.bulkApprove] ${failures.length}/${candidates.length} items en échec : ${failures.join(", ")}`,
      );
    }
    await logActivity({
      session,
      action: "content-gen.review.bulk-approve",
      targetType: "ReviewQueue",
      changes: { minScore, count: approved, selected: candidates.length, failed: failures.length },
    });
    revalidatePath(adminBase());
    return { approved };
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "bulkApproveReviews" } });
    throw e;
  }
}

/**
 * Bulk reject reviews (P1-12) — score < maxScore.
 */
export async function bulkRejectReviews(
  maxScore: number = 50,
  limit: number = 100,
): Promise<{ rejected: number }> {
  const session = await requireAdmin();
  try {
    // Sprint Final P1-3 — Zod runtime validation (structurel) avant checks métier.
    ScoreSchema.parse(maxScore);
    LimitSchema.parse(limit);
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
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "bulkRejectReviews" } });
    throw e;
  }
}

export async function rejectReview(id: string, notes: string): Promise<void> {
  const session = await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  ReviewIdSchema.parse(id);
  ReviewNotesRequiredSchema.parse(notes);
  if (notes.trim().length < 5) throw new Error("notes_required");
  // P1-C fix audit 2026-05-15 — race atomique (idem approveReview).
  try {
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
    // A-P2-04 (audit content-gen 2026-06-05) — aligne le ContentGenJob : avant ce
    // patch il restait bloqué en `needs_review` (orphelin, compteurs faussés).
    // Une review rejetée → job `cancelled` (terminal, non publié).
    await prisma.contentGenJob.updateMany({
      where: { reviewQueue: { id }, status: { in: ["needs_review", "quality_improving"] } },
      data: { status: "cancelled", errorMessage: "review_rejected" },
    });
    await logActivity({
      session,
      action: "content-gen.review.reject",
      targetType: "ReviewQueue",
      targetId: id,
      changes: { transition: "pending→rejected", notesLen: notes.length },
    });
    revalidatePath(adminBase());
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "rejectReview" } });
    throw e;
  }
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
  // Sprint Final P1-3 — Zod runtime validation.
  ReviewIdSchema.parse(id);
  ReviewNotesRequiredSchema.parse(comment);
  if (comment.trim().length < 10) throw new Error("comment_required");

  try {
    const review = await prisma.reviewQueue.findUnique({
      where: { id },
      select: {
        jobId: true,
        status: true,
        // Fix 2026-08-15 (E4) — nécessaires au payload et au jobId de la boucle
        // qualité (cf. enqueue ci-dessous).
        job: { select: { qualityScore: true, qualityImprovementAttempts: true } },
      },
    });
    if (!review) throw new Error("review_not_found");
    if (review.status !== "pending") throw new Error("review_not_pending");

    // Fix 2026-08-15 (audit e2e, E4) — garde AVANT la mutation : sans Redis,
    // poser `quality_improving` sans rien enfiler strandait le job à vie (le
    // seul producteur de `content-quality-improver` était le gen-worker —
    // 56 jobs figés depuis le 20/07 constatés en prod).
    const queue = getImproverQueue();
    if (!queue) {
      throw new Error(
        "redis_indisponible : impossible d'enfiler la demande de modifications — rien n'a été modifié.",
      );
    }

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

    // Fix 2026-08-15 (audit e2e, E4) — enfile RÉELLEMENT le job dans la boucle
    // qualité. Le jobId inclut le numéro de tentative (`-a<n>`, même format que
    // le gen-worker et le balayage de reprise) : un jobId fixe `quality-<id>`
    // serait silencieusement dédupliqué par BullMQ dès la 2ᵉ passe. Ordre des
    // opérations : la transaction DB d'abord — si l'enqueue échoue malgré tout,
    // le job est `quality_improving` sans porteur, état que le balayage
    // `sweepStrandedQualityJobs` réinjecte sous 1 h (aucun état perdu).
    const bullJobId = `quality-${review.jobId}-a${review.job.qualityImprovementAttempts}`;
    const existing = await queue.getJob(bullJobId);
    const action = resolveReenqueueAction(existing ? await existing.getState() : null);
    if (action === "remove-then-enqueue" && existing) {
      await existing.remove();
    }
    if (action !== "skip-in-flight") {
      await queue.add(
        "improve",
        { contentGenJobId: review.jobId, previousScore: review.job.qualityScore ?? 0 },
        { jobId: bullJobId },
      );
    }
    await logActivity({
      session,
      action: "content-gen.review.request-edits",
      targetType: "ReviewQueue",
      targetId: id,
      changes: { transition: "pending→needs_edits", commentLen: comment.length },
    });
    revalidatePath(adminBase());
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "requestEdits" } });
    throw e;
  }
}

export async function promoteToTier1(id: string): Promise<void> {
  const session = await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  ReviewIdSchema.parse(id);
  // P1-C fix audit 2026-05-15 — promote autorisé depuis `pending` (skip approve)
  // ou `approved` (déjà passé par tier-2). Ne pas autoriser depuis rejected /
  // needs_edits / promoted_t1.
  try {
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
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "promoteToTier1" } });
    throw e;
  }
}
