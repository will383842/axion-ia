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
// Fix 2026-08-15 (audit e2e) — options par défaut partagées : sans elles, les
// files ad-hoc créées ici héritaient du défaut BullMQ (1 seule tentative).
import { CONTENT_GEN_JOB_OPTIONS } from "@/server/content-gen/queue/job-options";
// Fix 2026-08-15 (audit e2e) — motif remove-then-enqueue + DB→queued + retryCount
// centralisé : la mutation DB n'a lieu qu'APRÈS la vérification d'un job en vol,
// ce qui élimine la fenêtre « queued en DB, absent de Redis » (zombie).
import { requeueContentGenJob } from "@/server/content-gen/recovery/backlog-recovery";
// Audit UX 2026-08-01 — colonne « Titre » sur la liste des jobs (repli sûr
// tant que le job n'a pas fini de générer, cf. docblock `extractJobTitle`).
import { extractJobTitle } from "@/server/content-gen/shared/admin-labels";
import { requireAdmin, requireSuperAdmin } from "./_auth";

// Sprint Final P1-3 — Zod runtime validation des inputs Server Actions.
const JobIdSchema = z.string().min(1).max(64);
// Fix 2026-08-15 (audit e2e, E10) — le schéma omettait `generating_text`,
// `generating_image` et `running_qa`, pourtant présents dans l'enum Prisma
// ContentGenJobStatus (14 valeurs) : filtrer la liste sur un job dans un de ces
// états faisait échouer la validation Zod. Aligné sur `prisma/schema.prisma`.
const ContentGenJobStatusSchema = z.enum([
  "queued",
  "running",
  "generating_text",
  "generating_image",
  "running_qa",
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
  // Fix 2026-08-15 (audit e2e) — `defaultJobOptions` partagées : sans elles la
  // file héritait du défaut BullMQ (1 tentative, pas de backoff) et un job qui
  // rencontrait le kill switch échouait définitivement au premier essai.
  contentGenQueue = new Queue("content-gen", {
    connection: { url: redisUrl },
    defaultJobOptions: CONTENT_GEN_JOB_OPTIONS,
  });
  return contentGenQueue;
}

/**
 * Fix 2026-08-15 (audit e2e, E1/E7) — le re-enfilage lui-même vit désormais dans
 * `requeueContentGenJob` (module partagé `backlog-recovery.ts`), qui applique le
 * motif remove-then-enqueue anti-zombie (cf. fix 2026-07-17 : BullMQ ignore
 * silencieusement un `add` dont la clé `gen-${id}` existe déjà) ET ne passe la DB
 * à `queued` qu'après la vérification d'un job en vol. Ici on ne garde que les
 * GARDES métier, évaluées AVANT toute mutation :
 *
 *  - `landing_ville` : CLI-only, hors REGISTRY worker (« No generator
 *    registered ») — l'ancien code refusait EN SILENCE après avoir passé la DB à
 *    `queued`, fabriquant un zombie garanti + un faux succès pour l'admin ;
 *  - statuts terminaux incohérents : rejouer un job `published` re-générerait ET
 *    re-publierait par-dessus un contenu en ligne ;
 *  - REDIS_URL absent : l'ancien code muait la DB puis abandonnait en silence.
 *
 * Chaque refus REMONTE une erreur claire à l'appelant — jamais de faux succès.
 */
const RETRYABLE_JOB_STATUSES: ReadonlyArray<ContentGenJobStatus> = [
  "failed",
  "cancelled",
  // E8 : les quarantaines doivent avoir une issue autre que la suppression
  // définitive (slot de campagne consommé à vie → contenu perdu à jamais).
  "quarantined_critical",
  "quarantined_factcheck",
];

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
  /** Titre du contenu généré (extrait de `outputJsonRaw.title`) — `null` tant
   * que le job n'a pas terminé sa génération (audit UX 2026-08-01, § Défaut 1). */
  readonly title: string | null;
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
  // Fix 2026-08-15 (audit e2e, E5) — "use server" fait de chaque export un
  // endpoint POST public : sans garde, cette lecture exposait toute la table
  // des jobs à un appelant non authentifié.
  await requireAdmin();
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
      title: extractJobTitle(r.outputJsonRaw),
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
  // Fix 2026-08-15 (audit e2e, E5) — sans garde, cette lecture renvoyait
  // l'`outputJsonRaw` complet + 100 logs à un appelant non authentifié.
  await requireAdmin();
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
    // Fix 2026-08-15 (audit e2e, E1/E7) — TOUTES les gardes AVANT la mutation DB.
    // L'ancien code passait le statut à `queued` PUIS appelait un enqueue qui
    // pouvait refuser en silence (landing_ville CLI-only, REDIS_URL absent,
    // job en vol) : job zombie garanti + faux succès affiché à l'admin.
    const dbJob = await prisma.contentGenJob.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        contentType: true,
        targetSearchIntent: true,
        inputPayload: true,
        retryCount: true,
      },
    });
    if (!dbJob) {
      throw new Error("job_introuvable : ce job n'existe pas (ou plus) en base.");
    }
    if (dbJob.contentType === "landing_ville") {
      throw new Error(
        "landing_ville_non_rejouable : ce type de job est généré par CLI uniquement " +
          "(hors REGISTRY worker) — le rejouer créerait un job que le worker refuserait.",
      );
    }
    if (!RETRYABLE_JOB_STATUSES.includes(dbJob.status)) {
      throw new Error(
        `retry_refuse_statut_${dbJob.status} : seuls les jobs en échec, annulés ou en ` +
          "quarantaine peuvent être rejoués (rejouer un job publié re-générerait et " +
          "re-publierait par-dessus le contenu en ligne).",
      );
    }
    const queue = getContentGenQueue();
    if (!queue) {
      throw new Error(
        "redis_indisponible : REDIS_URL absent — impossible d'enfiler le job, rien n'a été modifié.",
      );
    }
    // Le module partagé ne passe la DB à `queued` qu'APRÈS la vérification d'un
    // job en vol : aucune fenêtre d'état incohérent.
    const enfile = await requeueContentGenJob(queue, dbJob);
    if (!enfile) {
      throw new Error(
        "job_deja_en_vol : un job BullMQ actif porte déjà cette clé — rien n'a été modifié.",
      );
    }
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
    // Fix 2026-08-15 (audit e2e, E7) — refuse les transitions depuis un statut
    // terminal : annuler un job `published` écrasait son statut en `cancelled`
    // alors que le contenu reste en ligne (état menteur). `updateMany` filtré
    // = atomique, pas de fenêtre entre lecture et écriture.
    const res = await prisma.contentGenJob.updateMany({
      where: { id, status: { notIn: ["published", "cancelled", "failed"] } },
      data: {
        status: "cancelled",
        errorMessage: "Annulé manuellement par admin",
        completedAt: new Date(),
      },
    });
    if (res.count === 0) {
      throw new Error(
        "annulation_refusee : job introuvable ou déjà dans un statut terminal " +
          "(publié, annulé ou en échec) — rien n'a été modifié.",
      );
    }
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
  // Fix 2026-08-15 (audit e2e, E5) — endpoint POST public sans garde.
  await requireAdmin();
  // 2026-09-02 — la console affichait trois chiffres pour « les échecs » :
  // 1 453 (badge, jobs de campagne seulement), 1 462 (`failed` nus) et 1 482
  // (bouton de suppression, échecs + quarantaines). Le badge excluait sans
  // raison les jobs hors campagne (RSS, enfilage direct) : il s'aligne sur le
  // périmètre du bouton qu'il annonce.
  return prisma.contentGenJob.count({
    where: {
      status: { in: ["failed", "quarantined_critical", "quarantined_factcheck"] },
    },
  });
}

export async function retryAllFailed(): Promise<number> {
  const session = await requireAdmin();
  try {
    // Fix 2026-08-15 (audit e2e, E1) — REDIS_URL absent : l'ancien chemin muait
    // la DB puis abandonnait en silence job par job. On refuse d'emblée.
    const queue = getContentGenQueue();
    if (!queue) {
      throw new Error(
        "redis_indisponible : REDIS_URL absent — impossible d'enfiler les jobs, rien n'a été modifié.",
      );
    }
    // Fix 2026-08-15 (audit e2e, E1/E2) — les `landing_ville` sont exclus dès la
    // requête : CLI-only, l'enqueue les refusait en silence tout en les comptant
    // comme « relancés » (compteur menteur) et en les laissant zombies.
    const failed = await prisma.contentGenJob.findMany({
      where: { status: "failed", contentType: { not: "landing_ville" } },
      select: {
        id: true,
        contentType: true,
        targetSearchIntent: true,
        inputPayload: true,
        retryCount: true,
      },
      take: 500, // cap raisonnable pour éviter saturation BullMQ d'un coup
    });
    if (failed.length === 0) {
      revalidatePath(adminBase());
      return 0;
    }
    // Fix 2026-08-15 (audit e2e, E2) — plus d'`updateMany` en amont : chaque job
    // ne passe à `queued` qu'au moment de son PROPRE enfilage réussi (via le
    // module partagé `requeueContentGenJob`). Le compteur retourné ne compte que
    // les vrais enfilements ; les skips (job déjà en vol) et les erreurs sont
    // distingués dans les logs et le journal d'activité.
    let enqueued = 0;
    const skippedInFlight: string[] = [];
    const notEnqueued: string[] = [];
    for (const f of failed) {
      try {
        // Fix 2026-07-17 (conservé) — isolation par job : une exception au job k
        // ne doit pas empêcher k+1..N d'être repris.
        const enfile = await requeueContentGenJob(queue, f);
        if (enfile) enqueued++;
        else skippedInFlight.push(f.id);
      } catch (e) {
        notEnqueued.push(f.id);
        Sentry.captureException(e, {
          tags: { area: "content-gen", action: "retryAllFailed.enqueue" },
          extra: { contentGenJobId: f.id },
        });
      }
    }
    if (skippedInFlight.length > 0) {
      console.warn(
        `[jobs.retryAllFailed] ${skippedInFlight.length}/${failed.length} jobs déjà en vol dans BullMQ (non touchés) : ${skippedInFlight.join(", ")}`,
      );
    }
    if (notEnqueued.length > 0) {
      console.warn(
        `[jobs.retryAllFailed] ${notEnqueued.length}/${failed.length} jobs non ré-enfilés (repris par le balayage de reprise s'ils sont restés queued) : ${notEnqueued.join(", ")}`,
      );
    }
    revalidatePath(adminBase());
    await logActivity({
      session,
      action: "content-gen.job.retry-bulk",
      targetType: "ContentGenJob",
      changes: {
        count: enqueued,
        selected: failed.length,
        skippedInFlight: skippedInFlight.length,
        notEnqueued: notEnqueued.length,
      },
    });
    return enqueued;
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "retryAllFailed" } });
    throw e;
  }
}

// Fix 2026-08-15 (audit e2e, E3) — statuts visés par la suppression, partagés
// entre le compteur (affiché à l'admin) et la suppression (qui exige ce compte
// exact en confirmation).
const DELETABLE_JOB_STATUSES: ReadonlyArray<ContentGenJobStatus> = [
  "failed",
  "quarantined_critical",
  "quarantined_factcheck",
];

/**
 * Compte les jobs que `deleteFailedJobs` supprimerait. Fix 2026-08-15 (E3) —
 * sert à afficher le nombre exact dans l'UI de confirmation : l'admin doit le
 * retaper pour que la suppression soit acceptée.
 */
export async function countDeletableFailedJobs(): Promise<number> {
  // Fix 2026-08-15 (audit e2e, E5) — endpoint POST public sans garde sinon.
  await requireAdmin();
  return prisma.contentGenJob.count({
    where: { status: { in: [...DELETABLE_JOB_STATUSES] } },
  });
}

/**
 * Supprime les jobs en échec/bloqués (nettoyage console — 2026-07-02). Ce sont
 * des tentatives ratées SANS contenu publié. Suppression sûre côté relations :
 *  - GenerationLog.jobId + ReviewQueue.jobId sont en onDelete: Cascade (purgés
 *    automatiquement) ;
 *  - Article.generatedByJobId est une simple chaîne (pas de FK) → aucun article
 *    publié n'est impacté.
 *
 * ⚠️ Fix 2026-08-15 (audit e2e, E3) — cette suppression est DÉFINITIVE au sens
 * métier : un slot de campagne est consommé À VIE (`generatedCount` ne
 * redescend jamais, l'orchestrateur ne repasse jamais sur un slot servi).
 * Supprimer un job en échec, c'est renoncer À JAMAIS à son contenu — alors que
 * la majorité des échecs (pannes de crédit provider) sont régénérables via
 * retry. D'où trois gardes cumulées :
 *  1. `requireSuperAdmin` (un rôle `editor` pouvait détruire 1 500 contenus) ;
 *  2. confirmation obligatoire : l'appelant doit fournir le NOMBRE EXACT de
 *     jobs à supprimer — un POST accidentel ou une UI périmée ne détruit rien ;
 *  3. suppression par liste d'ids figée au moment de la vérification (pas de
 *     `deleteMany` sur statuts, qui pourrait embarquer des jobs apparus entre
 *     le comptage et le clic).
 * Retourne le nombre de jobs supprimés.
 */
export async function deleteFailedJobs(confirmationCount: number): Promise<number> {
  const session = await requireSuperAdmin();
  z.number().int().min(0).max(1_000_000).parse(confirmationCount);
  try {
    const rows = await prisma.contentGenJob.findMany({
      where: { status: { in: [...DELETABLE_JOB_STATUSES] } },
      select: { id: true },
    });
    if (rows.length !== confirmationCount) {
      throw new Error(
        `confirmation_invalide : ${rows.length} jobs seraient supprimés définitivement, ` +
          `mais la confirmation portait sur ${confirmationCount}. Rechargez la page et ` +
          "retapez le nombre exact affiché.",
      );
    }
    if (rows.length === 0) return 0;
    const res = await prisma.contentGenJob.deleteMany({
      where: { id: { in: rows.map((r) => r.id) } },
    });
    revalidatePath(adminBase());
    await logActivity({
      session,
      action: "content-gen.job.delete-failed-bulk",
      targetType: "ContentGenJob",
      changes: { count: res.count, confirmationCount },
    });
    return res.count;
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "deleteFailedJobs" } });
    throw e;
  }
}
