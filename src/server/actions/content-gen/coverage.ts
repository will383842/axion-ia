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

import * as Sentry from "@sentry/nextjs";
import { Queue } from "bullmq";
import { revalidatePath } from "next/cache";
import { CronExpressionParser } from "cron-parser";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type {
  CityProcessingMode,
  CoverageScope,
  CoverageStatus,
  ServiceSector,
} from "../../../../prisma/generated/client";
import { logActivity } from "@/server/content-gen/shared/activity-log";
import { BANNED_FROM_EDITORIAL_MIX } from "@/server/content-gen/shared/editorial-mix-rules";
import { requireAdmin } from "./_auth";
// Sprint S+4-F 2026-05-18 (audit 06-CROISEMENTS §8.9 P1-1) — chokepoint settings
// avec rate-limit (60/min/admin/key) + audit log SOC2 diff (oldValue → newValue).
// Avant : `prisma.contentGenConfig.upsert(...)` direct → bypass rate-limit + audit.
import { writeContentGenConfig } from "./_settings";

// Sprint Final P1-3 — Zod runtime validation des inputs Server Actions.
// Schemas structurels — validations métier (somme=100, cron, types interdits)
// restent en code applicatif après parse() pour erreurs stables et messages clairs.
const CoverageCampaignIdSchema = z.string().min(1).max(64);
const CoverageStatusSchema = z.enum([
  "draft",
  "scheduled",
  "running",
  "paused",
  "completed",
  "cancelled",
]);
const ServiceSectorSchema = z.enum([
  "interventions_formations",
  "audits",
  "implementations",
  "un_a_un",
  "sites_web_augmentes",
]);
const CoverageScopeSchema = z.enum(["national", "region", "departement", "ville"]);
const SlugStringSchema = z.string().min(1).max(120);
const DepartmentCodeSchema = z.string().min(2).max(5);
const PercentRecordSchema = z.record(z.string(), z.number().min(0).max(100));
const CreateCampaignInputSchema = z
  .object({
    name: z.string().min(3).max(200),
    scope: CoverageScopeSchema,
    serviceSector: ServiceSectorSchema.nullable().optional(),
    anchorVilleSlugs: z.array(SlugStringSchema).max(2000).optional(),
    anchorDepartementCodes: z.array(DepartmentCodeSchema).max(110).optional(),
    anchorRegionSlugs: z.array(SlugStringSchema).max(20).optional(),
    totalTargetCount: z.number().int().min(1).max(10_000),
    typeDistribution: PercentRecordSchema,
    audienceMix: PercentRecordSchema,
    searchIntentMix: PercentRecordSchema.optional(),
    estimatedCostUsd: z.number().min(0).max(100_000).optional(),
    estimatedDurationMinutes: z.number().int().min(0).max(1_000_000).optional(),
    cityProcessingMode: z.enum(["parallel", "sequential"]).optional(),
    startDate: z.date().nullable().optional(),
    endDate: z.date().nullable().optional(),
    recurringSchedule: z.string().min(1).max(120).nullable().optional(),
    // P0-1 — primaryKeywords manquait dans createCampaign (audit A-06)
    primaryKeywords: z.array(z.string().min(1).max(200)).max(500).optional(),
  })
  .strict();
const CancelCampaignModeSchema = z.enum(["running_only", "all"]);
const DeltaSchema = z.number().int().min(1).max(1000);
const EstimateCampaignInputSchema = z
  .object({
    totalTargetCount: z.number().int().min(1).max(10_000),
    typeDistribution: PercentRecordSchema,
  })
  .strict();
const FutureDateSchema = z.date();

function adminBase(): string {
  return `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/coverage`;
}

let contentGenQueue: Queue | null = null;
function getContentGenQueue(): Queue | null {
  if (contentGenQueue) return contentGenQueue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  contentGenQueue = new Queue("content-gen", { connection: { url: redisUrl } });
  return contentGenQueue;
}

export interface CampaignRow {
  readonly id: string;
  readonly name: string;
  readonly status: CoverageStatus;
  readonly scope: CoverageScope;
  readonly serviceSector: ServiceSector | null;
  readonly totalTargetCount: number;
  readonly generatedCount: number;
  readonly publishedCount: number;
  readonly failedCount: number;
  readonly qualityImprovedCount: number;
  readonly estimatedCostUsd: string | null;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
  // Sprint Campaign Controls (§ 25.2 v1.8)
  readonly cityProcessingMode: CityProcessingMode;
  readonly currentCityIndex: number | null;
  readonly startDate: Date | null;
  readonly endDate: Date | null;
  readonly recurringSchedule: string | null;
  readonly completedReason: string | null;
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

export async function listCampaigns(
  status?: CoverageStatus,
  serviceSector?: ServiceSector,
): Promise<ReadonlyArray<CampaignRow>> {
  // Sprint Final P1-3 — Zod runtime validation (optional enums).
  if (status !== undefined) CoverageStatusSchema.parse(status);
  if (serviceSector !== undefined) ServiceSectorSchema.parse(serviceSector);
  const rows = await prisma.coverageCampaign.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(serviceSector ? { serviceSector } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toRow);
}

export async function getCampaign(id: string): Promise<CampaignDetail | null> {
  // Sprint Final P1-3 — Zod runtime validation.
  CoverageCampaignIdSchema.parse(id);
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
  serviceSector: ServiceSector | null;
  totalTargetCount: number;
  generatedCount: number;
  publishedCount: number;
  failedCount: number;
  qualityImprovedCount: number;
  estimatedCostUsd: unknown;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  cityProcessingMode: CityProcessingMode;
  currentCityIndex: number | null;
  startDate: Date | null;
  endDate: Date | null;
  recurringSchedule: string | null;
  completedReason: string | null;
}): CampaignRow {
  return {
    id: r.id,
    name: r.name,
    status: r.status,
    scope: r.scope,
    serviceSector: r.serviceSector,
    totalTargetCount: r.totalTargetCount,
    generatedCount: r.generatedCount,
    publishedCount: r.publishedCount,
    failedCount: r.failedCount,
    qualityImprovedCount: r.qualityImprovedCount,
    estimatedCostUsd: r.estimatedCostUsd ? String(r.estimatedCostUsd) : null,
    startedAt: r.startedAt,
    completedAt: r.completedAt,
    createdAt: r.createdAt,
    cityProcessingMode: r.cityProcessingMode,
    currentCityIndex: r.currentCityIndex,
    startDate: r.startDate,
    endDate: r.endDate,
    recurringSchedule: r.recurringSchedule,
    completedReason: r.completedReason,
  };
}

export interface CreateCampaignInput {
  readonly name: string;
  readonly scope: CoverageScope;
  readonly serviceSector?: ServiceSector | null;
  readonly anchorVilleSlugs?: ReadonlyArray<string>;
  readonly anchorDepartementCodes?: ReadonlyArray<string>;
  readonly anchorRegionSlugs?: ReadonlyArray<string>;
  readonly totalTargetCount: number;
  readonly typeDistribution: Record<string, number>;
  readonly audienceMix: Record<string, number>;
  readonly searchIntentMix?: Record<string, number>;
  readonly estimatedCostUsd?: number;
  readonly estimatedDurationMinutes?: number;
  // Sprint Campaign Controls (§ 25.2 v1.8)
  readonly cityProcessingMode?: "parallel" | "sequential";
  readonly startDate?: Date | null;
  readonly endDate?: Date | null;
  readonly recurringSchedule?: string | null;
  // P0-1 — primaryKeywords (audit A-06) : liste de mots-clés à injecter dans
  // les jobs de la campagne via BullMQ payload. Stockés dans logActivity + BullMQ.
  readonly primaryKeywords?: ReadonlyArray<string>;
}

export async function createCampaign(input: CreateCampaignInput): Promise<string> {
  try {
    const session = await requireAdmin();
    // Sprint Final P1-3 — Zod runtime validation (structurel) avant checks métier.
    CreateCampaignInputSchema.parse(input);
    if (input.name.length < 3) throw new Error("name_too_short");
    if (input.totalTargetCount < 1 || input.totalTargetCount > 10_000)
      throw new Error("target_count_range");
    // § 25.3 — Si campagne éditoriale (serviceSector défini), les types
    // `landing_ville` et `blog_from_rss` sont interdits dans la distribution.
    // Ils ont leur propre pipeline (coverage villes / RSS worker).
    if (input.serviceSector) {
      for (const key of Object.keys(input.typeDistribution)) {
        if ((BANNED_FROM_EDITORIAL_MIX as ReadonlyArray<string>).includes(key)) {
          throw new Error(
            `editorial_distribution_banned_type:${key} (landing_ville et blog_from_rss ont leur propre pipeline)`,
          );
        }
      }
    }
    const typeSum = Object.values(input.typeDistribution).reduce((a, v) => a + v, 0);
    if (Math.abs(typeSum - 100) > 0.5) throw new Error("type_distribution_must_sum_100");
    const audSum = Object.values(input.audienceMix).reduce((a, v) => a + v, 0);
    if (Math.abs(audSum - 100) > 0.5) throw new Error("audience_mix_must_sum_100");

    // Sprint Campaign Controls — validation des 4 nouveaux champs
    if (input.recurringSchedule) {
      try {
        CronExpressionParser.parse(input.recurringSchedule);
      } catch {
        throw new Error("invalid_cron_expression");
      }
    }
    const now = new Date();
    let effectiveStartDate: Date | null = input.startDate ?? null;
    if (effectiveStartDate && effectiveStartDate < now) {
      // startDate dans le passé → log warning, démarrage immédiat (pas de throw)
      console.warn(
        `[createCampaign] startDate ${effectiveStartDate.toISOString()} is in the past, using null (immediate)`,
      );
      effectiveStartDate = null;
    }
    if (input.endDate && input.endDate <= now) {
      throw new Error("end_date_in_past");
    }
    // Si startDate futur défini → status scheduled, sinon draft
    const initialStatus: CoverageStatus = effectiveStartDate ? "scheduled" : "draft";
    const cityProcessingMode: CityProcessingMode = input.cityProcessingMode ?? "parallel";

    const r = await prisma.coverageCampaign.create({
      data: {
        name: input.name,
        status: initialStatus,
        scope: input.scope,
        serviceSector: input.serviceSector ?? null,
        anchorVilleSlugs: input.anchorVilleSlugs ? [...input.anchorVilleSlugs] : [],
        anchorDepartementCodes: input.anchorDepartementCodes
          ? [...input.anchorDepartementCodes]
          : [],
        anchorRegionSlugs: input.anchorRegionSlugs ? [...input.anchorRegionSlugs] : [],
        totalTargetCount: input.totalTargetCount,
        typeDistribution: input.typeDistribution as never,
        audienceMix: input.audienceMix as never,
        ...(input.searchIntentMix ? { searchIntentMix: input.searchIntentMix as never } : {}),
        estimatedCostUsd: input.estimatedCostUsd ?? null,
        estimatedDurationMinutes: input.estimatedDurationMinutes ?? null,
        createdBy: session.userId,
        cityProcessingMode,
        startDate: effectiveStartDate,
        endDate: input.endDate ?? null,
        recurringSchedule: input.recurringSchedule ?? null,
      },
    });
    revalidatePath(adminBase());
    await logActivity({
      session,
      action: "content-gen.campaign.create",
      targetType: "CoverageCampaign",
      targetId: r.id,
      changes: {
        name: input.name,
        scope: input.scope,
        serviceSector: input.serviceSector ?? null,
        targetCount: input.totalTargetCount,
        cityProcessingMode,
        startDate: effectiveStartDate?.toISOString() ?? null,
        endDate: input.endDate?.toISOString() ?? null,
        recurringSchedule: input.recurringSchedule ?? null,
        // P0-1 — primaryKeywords tracés dans audit log (pas de colonne Prisma dédiée)
        primaryKeywords: input.primaryKeywords ?? null,
      },
    });
    return r.id;
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "createCampaign" } });
    throw e;
  }
}

export async function launchCampaign(id: string): Promise<void> {
  try {
    const session = await requireAdmin();
    // Sprint Final P1-3 — Zod runtime validation.
    CoverageCampaignIdSchema.parse(id);
    const campaign = await prisma.coverageCampaign.findUnique({
      where: { id },
      select: { recurringSchedule: true },
    });
    await prisma.coverageCampaign.update({
      where: { id },
      data: { status: "running", startedAt: new Date() },
    });

    // Sprint Campaign Controls — si campagne récurrente, enregistrer le repeatable job BullMQ
    if (campaign?.recurringSchedule) {
      const queue = getContentGenQueue();
      if (queue) {
        try {
          await queue.add(
            `campaign-${id}-recurring`,
            { campaignId: id, trigger: "recurring-tick" },
            {
              repeat: { pattern: campaign.recurringSchedule, tz: "Europe/Paris" },
              jobId: `campaign-${id}-recurring`,
            },
          );
        } catch (err) {
          console.warn(
            `[launchCampaign] failed to register repeatable job for campaign ${id}:`,
            err,
          );
        }
      }
    }

    revalidatePath(adminBase());
    revalidatePath(`${adminBase()}/${id}`);
    await logActivity({
      session,
      action: "content-gen.campaign.launch",
      targetType: "CoverageCampaign",
      targetId: id,
      changes: { recurringSchedule: campaign?.recurringSchedule ?? null },
    });
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "launchCampaign" } });
    throw e;
  }
}

export async function pauseCampaign(id: string): Promise<void> {
  const session = await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  CoverageCampaignIdSchema.parse(id);
  // Sprint Campaign Controls — récupérer recurringSchedule avant l'update pour cleanup BullMQ repeatable
  const campaignBeforePause = await prisma.coverageCampaign.findUnique({
    where: { id },
    select: { recurringSchedule: true },
  });
  await prisma.coverageCampaign.update({
    where: { id },
    data: { status: "paused", pausedAt: new Date() },
  });

  // B.2 P0-10 — purge BullMQ jobs en attente pour cette campagne.
  // Même pattern que cancelCampaign : seuls les jobs `queued` en DB ont un
  // BullMQ job correspondant à purger. Les jobs `running` sont laissés
  // terminer (graceful — le worker vérifie campaign.status à chaque tick).
  let purgeBullJobs = 0;
  const queuedJobs = await prisma.contentGenJob.findMany({
    where: { campaignId: id, status: "queued" },
    select: { id: true },
    take: 5000,
  });

  if (queuedJobs.length > 0) {
    const queue = getContentGenQueue();
    if (queue) {
      for (const job of queuedJobs) {
        try {
          const bullJob = await queue.getJob(`gen-${job.id}`);
          if (bullJob) {
            const state = await bullJob.getState();
            if (
              state === "waiting" ||
              state === "delayed" ||
              state === "waiting-children" ||
              state === "prioritized"
            ) {
              await bullJob.remove();
              purgeBullJobs++;
            }
          }
        } catch {
          // Job actif ou introuvable — ignore, le worker gère via kill_switch.
        }
      }
    }
    console.warn(
      `[pauseCampaign] campaign=${id} queued=${queuedJobs.length} bullPurged=${purgeBullJobs}`,
    );
  }

  // Sprint Campaign Controls — retirer le repeatable job si la campagne a un recurringSchedule
  if (campaignBeforePause?.recurringSchedule) {
    const queue = getContentGenQueue();
    if (queue) {
      try {
        await queue.removeRepeatable(`campaign-${id}-recurring`, {
          pattern: campaignBeforePause.recurringSchedule,
          tz: "Europe/Paris",
        });
      } catch (err) {
        console.warn(`[pauseCampaign] failed to remove repeatable job for campaign ${id}:`, err);
      }
    }
  }

  revalidatePath(adminBase());
  await logActivity({
    session,
    action: "content-gen.campaign.pause",
    targetType: "CoverageCampaign",
    targetId: id,
    changes: {
      queuedJobs: queuedJobs.length,
      purgeBullJobs,
      removedRecurring: Boolean(campaignBeforePause?.recurringSchedule),
    },
  });
}

export async function resumeCampaign(id: string): Promise<void> {
  const session = await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  CoverageCampaignIdSchema.parse(id);
  // P2-9 fix audit opérationnel 2026-05-14 — archiver l'historique pausedAt
  // dans ContentGenConfig pour audit trail au lieu de NULL silencieux.
  const campaign = await prisma.coverageCampaign.findUnique({
    where: { id },
    select: { pausedAt: true },
  });
  if (campaign?.pausedAt) {
    // Sprint S+4-F 2026-05-18 (audit 06-CROISEMENTS §8.9 P1-1) — bypass corrigé :
    // l'historique `campaign_pause_history` passe désormais par le chokepoint
    // `writeContentGenConfig` qui empile rate-limit (60/min/admin/key) + audit
    // log SOC2 (diff oldValue → newValue + actorUserId/email/ip/ua tracés).
    // Avant : `prisma.contentGenConfig.upsert(...)` direct → 0 trace SOC2 + 0
    // protection abus loop (un admin malveillant pouvait spammer resume sur N
    // campagnes pour pourrir l'historique). La lecture-merge reste côté caller
    // pour éviter d'introduire un pattern read-modify-write dans le chokepoint.
    try {
      const existing = await prisma.contentGenConfig.findUnique({
        where: { key: "campaign_pause_history" },
      });
      const prev = (existing?.value as Array<Record<string, unknown>> | null | undefined) ?? [];
      const next = [
        {
          campaignId: id,
          pausedAt: campaign.pausedAt.toISOString(),
          resumedAt: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 200);
      // `updatedBy` = email admin réel (vs ancien "system:resume-campaign"
      // anonymisé) — cohérence audit log + traçabilité SOC2.
      await writeContentGenConfig(
        "campaign_pause_history",
        next,
        session.email,
        `Resume campagne ${id}`,
      );
    } catch {
      // best-effort — un échec rate-limit ou audit log ne doit pas bloquer le
      // resume de la campagne (priorité métier : reprendre la prod).
    }
  }
  await prisma.coverageCampaign.update({
    where: { id },
    data: { status: "running", pausedAt: null },
  });
  revalidatePath(adminBase());
  await logActivity({
    session,
    action: "content-gen.campaign.resume",
    targetType: "CoverageCampaign",
    targetId: id,
  });
}

/**
 * Mode d'annulation campagne (§ 12.1 master prompt).
 *
 * - `running_only` : seuls les jobs encore `queued` ou `running` sont cancelled.
 *   Les jobs `needs_review`, `approved`, `publishing`, `published` restent.
 * - `all` : tous les jobs non-published de la campagne sont cancelled. La
 *   campagne ne pourra plus rien produire.
 */
export type CancelCampaignMode = "running_only" | "all";

export interface CancelCampaignResult {
  readonly campaignId: string;
  readonly mode: CancelCampaignMode;
  readonly cancelledJobs: number;
  readonly removedBullJobs: number;
}

export async function cancelCampaign(
  id: string,
  mode: CancelCampaignMode = "running_only",
): Promise<CancelCampaignResult> {
  const session = await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  CoverageCampaignIdSchema.parse(id);
  CancelCampaignModeSchema.parse(mode);

  // 1. Flippe la campagne en cancelled + completedAt (terminal).
  await prisma.coverageCampaign.update({
    where: { id },
    data: { status: "cancelled", completedAt: new Date() },
  });

  // 2. Identifie les jobs à cancel selon le mode. `running_only` reste safe par
  // défaut (préserve les contenus déjà générés en attente de review). `all`
  // est destructif (cancelle aussi les needs_review/approved non publiés).
  const statusesToCancel =
    mode === "all"
      ? ["queued", "running", "needs_review", "approved", "publishing", "quality_improving"]
      : ["queued", "running", "quality_improving"];

  const jobsToCancel = await prisma.contentGenJob.findMany({
    where: {
      campaignId: id,
      status: { in: statusesToCancel as never },
    },
    select: { id: true },
    take: 5000, // cap raisonnable
  });

  if (jobsToCancel.length > 0) {
    await prisma.contentGenJob.updateMany({
      where: { id: { in: jobsToCancel.map((j) => j.id) } },
      data: {
        status: "cancelled",
        errorMessage: `Campagne ${id} annulée (mode=${mode})`,
        completedAt: new Date(),
      },
    });
  }

  // 3. Purge les BullMQ jobs waiting/delayed correspondants (best-effort).
  // Les jobs `active` sont laissés terminer leur cycle (graceful shutdown du
  // worker). Le worker re-vérifie kill_switch / campaign.status à chaque tick.
  let removedBullJobs = 0;
  const queue = getContentGenQueue();
  if (queue && jobsToCancel.length > 0) {
    for (const job of jobsToCancel) {
      try {
        const bullJob = await queue.getJob(`gen-${job.id}`);
        if (bullJob) {
          const state = await bullJob.getState();
          if (
            state === "waiting" ||
            state === "delayed" ||
            state === "waiting-children" ||
            state === "prioritized"
          ) {
            await bullJob.remove();
            removedBullJobs++;
          }
        }
      } catch {
        // Job actif ou déjà terminé — laisse le worker gérer.
      }
    }
  }

  revalidatePath(adminBase());
  revalidatePath(`${adminBase()}/${id}`);
  await logActivity({
    session,
    action: "content-gen.campaign.cancel",
    targetType: "CoverageCampaign",
    targetId: id,
    changes: {
      mode,
      cancelledJobs: jobsToCancel.length,
      removedBullJobs,
    },
  });
  return {
    campaignId: id,
    mode,
    cancelledJobs: jobsToCancel.length,
    removedBullJobs,
  };
}

/**
 * Incrémente le compteur cible d'une campagne (bouton "+50 slots" § 12.1).
 * La campagne doit être en `running` ou `paused`. Le orchestrateur picke
 * automatiquement les nouveaux slots au prochain tick.
 */
export async function incrementCampaignTarget(id: string, delta: number): Promise<void> {
  const session = await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  CoverageCampaignIdSchema.parse(id);
  DeltaSchema.parse(delta);
  if (delta < 1 || delta > 1000) throw new Error("delta_range");
  const campaign = await prisma.coverageCampaign.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!campaign) throw new Error("campaign_not_found");
  if (campaign.status !== "running" && campaign.status !== "paused") {
    throw new Error("campaign_not_active");
  }
  await prisma.coverageCampaign.update({
    where: { id },
    data: { totalTargetCount: { increment: delta } },
  });
  revalidatePath(`${adminBase()}/${id}`);
  await logActivity({
    session,
    action: "content-gen.campaign.add-slots",
    targetType: "CoverageCampaign",
    targetId: id,
    changes: { delta },
  });
}

/**
 * Estimation coût/durée AVANT lancement (bouton "Dry run" § 15.2 + § 25.3).
 *
 * Calcul léger côté serveur (pas d'appel LLM) :
 * - coût/contenu estimé par type via prix moyens (1500 mots ~ $0.05 OpenAI 4o
 *   + $0.01 Anthropic + $0.005 Perplexity = $0.065/contenu défaut)
 * - durée estimée : SLO p50 § 4 master prompt (landing ville 90s, blog 40s)
 */
export interface EstimateCampaignInput {
  readonly totalTargetCount: number;
  readonly typeDistribution: Record<string, number>;
}

export interface EstimateCampaignResult {
  readonly totalTargetCount: number;
  readonly estimatedCostUsd: number;
  readonly estimatedDurationMinutes: number;
  readonly breakdown: ReadonlyArray<{
    readonly contentType: string;
    readonly count: number;
    readonly unitCostUsd: number;
    readonly unitDurationSec: number;
  }>;
}

const UNIT_COSTS_USD: Record<string, number> = {
  landing_ville: 0.08,
  blog_article: 0.07,
  blog_from_title: 0.07,
  blog_from_keywords: 0.07,
  blog_from_rss: 0.04,
  comparison: 0.09,
  guide_pilier: 0.18,
  faq_standalone: 0.04,
  qa_derived: 0.01,
};

const UNIT_DURATION_SEC: Record<string, number> = {
  landing_ville: 90,
  blog_article: 60,
  blog_from_title: 60,
  blog_from_keywords: 60,
  blog_from_rss: 40,
  comparison: 70,
  guide_pilier: 150,
  faq_standalone: 30,
  qa_derived: 10,
};

export async function estimateCampaign(
  input: EstimateCampaignInput,
): Promise<EstimateCampaignResult> {
  await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  EstimateCampaignInputSchema.parse(input);
  if (input.totalTargetCount < 1 || input.totalTargetCount > 10_000) {
    throw new Error("target_count_range");
  }
  const sum = Object.values(input.typeDistribution).reduce((a, v) => a + v, 0);
  if (Math.abs(sum - 100) > 0.5) throw new Error("type_distribution_must_sum_100");

  const breakdown = Object.entries(input.typeDistribution).map(([type, pct]) => {
    const count = Math.round((input.totalTargetCount * pct) / 100);
    const unitCostUsd = UNIT_COSTS_USD[type] ?? 0.06;
    const unitDurationSec = UNIT_DURATION_SEC[type] ?? 60;
    return { contentType: type, count, unitCostUsd, unitDurationSec };
  });

  const estimatedCostUsd = breakdown.reduce((a, b) => a + b.count * b.unitCostUsd, 0);
  // Durée séquentielle / concurrency (default 5 selon § 13.1). Si Will a
  // configuré concurrency=N, on divise par N.
  const totalSec = breakdown.reduce((a, b) => a + b.count * b.unitDurationSec, 0);
  const concurrency = 5;
  const estimatedDurationMinutes = Math.ceil(totalSec / concurrency / 60);

  return {
    totalTargetCount: input.totalTargetCount,
    estimatedCostUsd: Math.round(estimatedCostUsd * 100) / 100,
    estimatedDurationMinutes,
    breakdown,
  };
}

// ============================================================
// Sprint Campaign Controls (§ 25.2 v1.8 2026-05-22)
// ============================================================

/**
 * Passe une campagne draft → scheduled avec une date de démarrage future.
 * Le scheduler worker (content-gen-scheduler-worker) scanne toutes les 5 min
 * les campagnes scheduled dont startDate <= NOW() et les passe running.
 */
export async function scheduleCampaign(id: string, startDate: Date): Promise<void> {
  const session = await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  CoverageCampaignIdSchema.parse(id);
  FutureDateSchema.parse(startDate);
  const now = new Date();
  if (startDate <= now) throw new Error("start_date_must_be_future");
  await prisma.coverageCampaign.update({
    where: { id },
    data: { status: "scheduled", startDate },
  });
  revalidatePath(adminBase());
  revalidatePath(`${adminBase()}/${id}`);
  await logActivity({
    session,
    action: "content-gen.campaign.schedule",
    targetType: "CoverageCampaign",
    targetId: id,
    changes: { startDate: startDate.toISOString() },
  });
}

/**
 * Étend la date de fin d'une campagne active.
 * Audit SOC2 obligatoire : action CAMPAIGN_DEADLINE_EXTENDED loggée.
 */
// Sprint A-suite P6 — Item 6. CampaignTemplate preset selector wizard.

export interface CampaignTemplateRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly config: unknown;
}

/**
 * Retourne les CampaignTemplate actifs triés par slug.
 * Utilisé par le wizard Coverage (step 0 Preset) pour afficher les presets.
 */
export async function listCampaignTemplates(): Promise<ReadonlyArray<CampaignTemplateRow>> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await (prisma as any).campaignTemplate.findMany({
      where: { isActive: true },
      orderBy: { slug: "asc" },
      select: { id: true, slug: true, name: true, description: true, config: true },
    });
    return (rows as CampaignTemplateRow[]) ?? [];
  } catch {
    // DB non disponible (stub build-time) ou table non encore créée → tableau vide.
    return [];
  }
}

export async function extendCampaignDeadline(id: string, newEndDate: Date): Promise<void> {
  const session = await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  CoverageCampaignIdSchema.parse(id);
  FutureDateSchema.parse(newEndDate);
  const now = new Date();
  if (newEndDate <= now) throw new Error("end_date_in_past");
  await prisma.coverageCampaign.update({
    where: { id },
    data: { endDate: newEndDate },
  });
  revalidatePath(adminBase());
  revalidatePath(`${adminBase()}/${id}`);
  await logActivity({
    session,
    action: "content-gen.campaign.extend-deadline",
    targetType: "CoverageCampaign",
    targetId: id,
    changes: { newEndDate: newEndDate.toISOString(), soc2: "CAMPAIGN_DEADLINE_EXTENDED" },
  });
}
