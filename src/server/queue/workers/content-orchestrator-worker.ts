/**
 * Content Generator — Orchestrator worker (§ 25.3 master prompt v1.7).
 *
 * Pick CoverageCampaign WHERE status='running' AND generatedCount < totalTargetCount.
 * Pour chaque campagne :
 *  1. Sample distribution selon typeDistribution + audienceMix + searchIntentMix
 *  2. Crée N ContentGenJob rows (batch tick = min(perCampaignTick, restant))
 *  3. Enqueue jobs vers queue 'content-gen' (worker primaire pick)
 *  4. Met à jour CoverageCampaign.generatedCount
 *
 * Cron toutes les 15 minutes (96 ticks/jour). Budget par campagne (V2) :
 *  - si dailyTargetByType configuré → anti-burst par type
 *  - sinon → ceil(campaign.dailyArticles / 96) par tick
 *
 * Idempotency : ContentGenJob.idempotencyKey = hash(campaign.id + tickIndex)
 * pour éviter doublons si le worker tick re-trigger plus tôt que prévu.
 */

import { Queue, Worker, type Job } from "bullmq";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { readContentGenConfig } from "@/server/actions/content-gen/_settings";
import {
  computeAntiBurstSchedule,
  msSinceStartOfDay,
} from "@/server/content-gen/scheduler/anti-burst";
import { buildWeightedSequence } from "@/server/content-gen/scheduler/type-sequence";
import { alertCampaignDone } from "@/server/content-gen/shared/content-gen-alerts";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import type {
  CityProcessingMode,
  CompanySize,
  ContentType,
  OrganisationType,
  SearchIntent,
  ServiceSector,
} from "../../../../prisma/generated/client";

const QUEUE_NAME = "content-orchestrator";

// 2026-06-14 — L'orchestrateur ne force PLUS de mot-clé template pour
// `blog_from_keywords`. Auparavant il injectait `inputPayload.primaryKeyword`
// via un mini-template à 5 valeurs (« audit IA » + ville), ce qui
// court-circuitait la rotation atomique du vrai pool (~2000 mots-clés longue
// traîne) déjà câblée dans le content-gen-worker (selectKeyword, filtré par
// vertical de la campagne). Désormais on laisse `primaryKeyword` vide : le
// worker pioche dans le pool riche, et la ville reste portée séparément par
// `anchorVilleSlug` (la localisation du contenu n'en dépend pas). Résultat :
// diversité longue traîne réellement exploitée, zéro régression géo.

interface BatchSettings {
  readonly workersConcurrency: number;
  readonly dailyTargetByType?: Partial<Record<ContentType, number>>;
  readonly antiBurstEnabled?: boolean;
}

interface KillSwitchState {
  readonly active: boolean;
}

let contentGenQueue: Queue | null = null;
function getContentGenQueue(): Queue {
  if (contentGenQueue) return contentGenQueue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set");
  contentGenQueue = new Queue("content-gen", { connection: { url: redisUrl } });
  return contentGenQueue;
}

/**
 * Sélection déterministe par slot index. Garantit une distribution exacte
 * sur N slots sans dérive aléatoire (remplace Math.random()).
 * seed = offset pour décorreler type / intent / audience sur le même slotIndex.
 * Ex : dist={A:40,B:30,C:30}, slotIndex=0→A, slotIndex=40→B, slotIndex=70→C.
 */
function sampleWeighted<K extends string>(
  dist: Record<K, number>,
  slotIndex: number,
  seed = 0,
): K | null {
  const entries = Object.entries(dist) as Array<[K, number]>;
  if (entries.length === 0) return null;
  const total = entries.reduce((a, [, w]) => a + w, 0);
  if (total <= 0) return null;
  const position = (slotIndex + seed) % total;
  let cumulative = 0;
  for (const [key, w] of entries) {
    cumulative += w;
    if (position < cumulative) return key;
  }
  return entries[entries.length - 1]![0];
}

function sampleAudienceMix(
  mix: Record<string, number>,
  slotIndex: number,
): { size: CompanySize; org: OrganisationType } | null {
  const key = sampleWeighted(mix, slotIndex, 37);
  if (!key) return null;
  const [size, org] = key.split(":") as [string, string];
  if (!size || !org) return null;
  return { size: size as CompanySize, org: org as OrganisationType };
}

/**
 * Crée 1 ContentGenJob row + enqueue BullMQ pour un slot donné.
 * Factorisée pour partager la logique entre mode parallel et sequential.
 *
 * @returns true si enqueue réussi, false si idempotency hit ou erreur soft
 */
async function createJobForSlot(opts: {
  campaign: {
    id: string;
    name: string;
    serviceSector: ServiceSector | null;
  };
  contentType: ContentType;
  aud: { size: CompanySize; org: OrganisationType } | null;
  searchIntent: SearchIntent | "informational";
  anchorVilleSlug?: string;
  anchorDepartementCode?: string;
  anchorRegionSlug?: string;
  slotIndex: number;
}): Promise<boolean> {
  const {
    campaign,
    contentType,
    aud,
    searchIntent,
    anchorVilleSlug,
    anchorDepartementCode,
    anchorRegionSlug,
    slotIndex,
  } = opts;
  const idempotencyKey = crypto
    .createHash("sha256")
    .update(
      `${campaign.id}::${slotIndex}::${contentType}::${anchorVilleSlug ?? anchorRegionSlug ?? "global"}`,
    )
    .digest("hex")
    .slice(0, 32);

  // Sprint A-suite P6 — Item 3. correlationId UUID v4 pour traçabilité
  // end-to-end orchestrateur → gen-worker → publish-worker.
  const correlationId = crypto.randomUUID();

  try {
    const job = await prisma.contentGenJob.create({
      data: {
        idempotencyKey,
        contentType: contentType as ContentType,
        status: "queued",
        priority: 5,
        campaignId: campaign.id,
        // Catégorisation 2026-06-16 — propage le secteur de la campagne au job
        // (→ categoryId de l'article au publish via category-mapper).
        ...(campaign.serviceSector ? { serviceSector: campaign.serviceSector } : {}),
        correlationId,
        inputPayload: {
          campaignName: campaign.name,
          slotIndex,
          // Pas de primaryKeyword forcé : le content-gen-worker sélectionne dans
          // le pool riche via selectKeyword (rotation atomique, filtré vertical).
        },
        targetLocale: "fr",
        ...(anchorVilleSlug ? { anchorVilleSlug } : {}),
        ...(anchorDepartementCode ? { anchorDepartementCode } : {}),
        ...(anchorRegionSlug ? { anchorRegionSlug } : {}),
        ...(aud ? { targetAudienceSize: aud.size, targetAudienceOrganisation: aud.org } : {}),
        targetSearchIntent: searchIntent as SearchIntent,
        primaryProvider: "openai",
        fallbackProvider: "anthropic",
      },
    });
    await getContentGenQueue().add(
      "generate",
      {
        contentGenJobId: job.id,
        contentType: job.contentType,
        targetSearchIntent: job.targetSearchIntent,
        inputPayload: job.inputPayload,
      },
      { jobId: `gen-${job.id}` },
    );
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("Unique constraint")) {
      console.error("[orchestrator] insert ContentGenJob failed:", msg);
    }
    return false;
  }
}

/**
 * Résout la liste de villes pour une campagne :
 *  - custom_subset → customVilleSlugs (ou anchorVilleSlugs en fallback)
 *  - global_queue  → top-200 de CityGenerationOrder (pinned d'abord, puis rank)
 *  - (héritage)    → anchorVilleSlugs de la campagne
 */
async function resolveVilleAnchors(campaign: {
  villeScopeMode: string;
  customVilleSlugs: string[];
  anchorVilleSlugs: string[];
  scope: string;
}): Promise<string[]> {
  if (campaign.villeScopeMode === "custom_subset") {
    return campaign.customVilleSlugs.length > 0
      ? campaign.customVilleSlugs
      : campaign.anchorVilleSlugs;
  }
  if (campaign.anchorVilleSlugs.length > 0) return campaign.anchorVilleSlugs;
  if (campaign.scope === "ville" || campaign.scope === "multi") {
    const rows = await prisma.cityGenerationOrder.findMany({
      orderBy: [{ pinned: "desc" }, { rank: "asc" }],
      take: 200,
      select: { villeSlug: true },
    });
    return rows.map((r) => r.villeSlug);
  }
  return [];
}

/**
 * Mode séquentiel : traite une seule ville à la fois.
 * Attend que tous les jobs de la ville courante soient terminés avant de passer à la suivante.
 * Met à jour currentCityIndex après enqueue de la nouvelle ville.
 */
async function processSequentialCampaign(
  campaign: {
    id: string;
    name: string;
    serviceSector: ServiceSector | null;
    anchorDepartementCodes: string[];
    anchorRegionSlugs: string[];
    typeDistribution: unknown;
    contentTypeWeights: unknown;
    audienceMix: unknown;
    searchIntentMix: unknown;
    scope: string;
    currentCityIndex: number | null;
    generatedCount: number;
    totalTargetCount: number;
    cityProcessingMode: CityProcessingMode;
  },
  toEnqueue: number,
  hasPerTypeMode: boolean,
  remainingByType: Partial<Record<ContentType, number>>,
  villeAnchors: string[],
): Promise<number> {
  if (villeAnchors.length === 0) {
    // Pas de villes → fallback parallel (scope non-ville)
    return processParallelCampaign(
      campaign,
      toEnqueue,
      hasPerTypeMode,
      remainingByType,
      undefined,
      villeAnchors,
    );
  }

  const currentCityIdx = campaign.currentCityIndex ?? 0;
  if (currentCityIdx >= villeAnchors.length) {
    // Toutes les villes terminées → ne rien enqueue
    console.log(
      `[orchestrator] sequential campaign=${campaign.id} all cities done (idx=${currentCityIdx}/${villeAnchors.length})`,
    );
    return 0;
  }

  const currentCitySlug = villeAnchors[currentCityIdx]!;

  // Compter les jobs en cours pour cette ville
  const pendingCount = await prisma.contentGenJob.count({
    where: {
      campaignId: campaign.id,
      anchorVilleSlug: currentCitySlug,
      status: { in: ["queued", "running", "needs_review", "quality_improving"] },
    },
  });

  if (pendingCount > 0) {
    // Ville en cours — attendre la prochaine tick
    console.log(
      `[orchestrator] sequential campaign=${campaign.id} city=${currentCitySlug} pending=${pendingCount}, waiting`,
    );
    return 0;
  }

  // Ville courante terminée (ou jamais démarrée) → créer les jobs pour cette ville
  const typeDist = (
    campaign.contentTypeWeights != null ? campaign.contentTypeWeights : campaign.typeDistribution
  ) as Record<ContentType, number>;
  const audienceMix = campaign.audienceMix as Record<string, number>;
  const intentMix = campaign.searchIntentMix as Record<SearchIntent, number> | null;

  // Séquence de types entrelacée pour toute la campagne, indexée par slot global.
  const typeSeq = buildWeightedSequence(
    typeDist,
    Math.max(campaign.totalTargetCount, campaign.generatedCount + toEnqueue),
  );

  let enqueued = 0;
  for (let i = 0; i < toEnqueue; i++) {
    const slotIndex = campaign.generatedCount + i;
    let contentType: ContentType | null;
    if (hasPerTypeMode) {
      const next = Object.entries(remainingByType).find(([, count]) => (count ?? 0) > 0);
      if (!next) break;
      contentType = next[0] as ContentType;
      remainingByType[contentType] = (remainingByType[contentType] ?? 1) - 1;
    } else {
      contentType = typeSeq[slotIndex] ?? sampleWeighted(typeDist, slotIndex);
    }
    if (!contentType) continue;
    const aud = sampleAudienceMix(audienceMix, slotIndex);
    const searchIntent = intentMix ? sampleWeighted(intentMix, slotIndex, 73) : "informational";
    const ok = await createJobForSlot({
      campaign,
      contentType,
      aud,
      searchIntent: (searchIntent ?? "informational") as SearchIntent,
      anchorVilleSlug: currentCitySlug,
      slotIndex,
    });
    if (ok) enqueued++;
  }

  // Avancer l'index de ville
  await prisma.coverageCampaign.update({
    where: { id: campaign.id },
    data: { currentCityIndex: currentCityIdx + 1 },
  });

  console.log(
    `[orchestrator] sequential campaign=${campaign.id} city=${currentCitySlug} (${currentCityIdx + 1}/${villeAnchors.length}) enqueued=${enqueued}`,
  );
  return enqueued;
}

/**
 * Mode parallèle : comportement original — toutes les villes simultanément.
 * forcedVilleSlug permet de forcer une ville (appelé depuis sequential pour scope non-ville).
 */
async function processParallelCampaign(
  campaign: {
    id: string;
    name: string;
    serviceSector: ServiceSector | null;
    anchorDepartementCodes: string[];
    anchorRegionSlugs: string[];
    typeDistribution: unknown;
    contentTypeWeights: unknown;
    audienceMix: unknown;
    searchIntentMix: unknown;
    scope: string;
    generatedCount: number;
    totalTargetCount: number;
  },
  toEnqueue: number,
  hasPerTypeMode: boolean,
  remainingByType: Partial<Record<ContentType, number>>,
  forcedVilleSlug: string | undefined,
  villeAnchors: string[],
): Promise<number> {
  const typeDist = (
    campaign.contentTypeWeights != null ? campaign.contentTypeWeights : campaign.typeDistribution
  ) as Record<ContentType, number>;
  const audienceMix = campaign.audienceMix as Record<string, number>;
  const intentMix = campaign.searchIntentMix as Record<SearchIntent, number> | null;
  const deptAnchors = campaign.anchorDepartementCodes;
  const regionAnchors = campaign.anchorRegionSlugs;

  // Séquence de types entrelacée pour toute la campagne, indexée par slot global.
  const typeSeq = buildWeightedSequence(
    typeDist,
    Math.max(campaign.totalTargetCount, campaign.generatedCount + toEnqueue),
  );

  let enqueued = 0;
  for (let i = 0; i < toEnqueue; i++) {
    const slotIndex = campaign.generatedCount + i;
    let contentType: ContentType | null;
    if (hasPerTypeMode) {
      const next = Object.entries(remainingByType).find(([, count]) => (count ?? 0) > 0);
      if (!next) break;
      contentType = next[0] as ContentType;
      remainingByType[contentType] = (remainingByType[contentType] ?? 1) - 1;
    } else {
      contentType = typeSeq[slotIndex] ?? sampleWeighted(typeDist, slotIndex);
    }
    if (!contentType) continue;
    const aud = sampleAudienceMix(audienceMix, slotIndex);
    const searchIntent = intentMix ? sampleWeighted(intentMix, slotIndex, 73) : "informational";

    let anchorVilleSlug: string | undefined = forcedVilleSlug;
    let anchorDepartementCode: string | undefined;
    let anchorRegionSlug: string | undefined;

    if (!anchorVilleSlug) {
      if (campaign.scope === "ville" && villeAnchors.length > 0) {
        anchorVilleSlug = villeAnchors[slotIndex % villeAnchors.length];
      } else if (campaign.scope === "departement" && deptAnchors.length > 0) {
        anchorDepartementCode = deptAnchors[slotIndex % deptAnchors.length];
      } else if (campaign.scope === "region" && regionAnchors.length > 0) {
        anchorRegionSlug = regionAnchors[slotIndex % regionAnchors.length];
      } else if (campaign.scope === "multi") {
        if (villeAnchors.length > 0) {
          anchorVilleSlug = villeAnchors[slotIndex % villeAnchors.length];
        } else if (regionAnchors.length > 0) {
          anchorRegionSlug = regionAnchors[slotIndex % regionAnchors.length];
        }
      }
    }
    const ok = await createJobForSlot({
      campaign,
      contentType,
      aud,
      searchIntent: (searchIntent ?? "informational") as SearchIntent,
      ...(anchorVilleSlug ? { anchorVilleSlug } : {}),
      ...(anchorDepartementCode ? { anchorDepartementCode } : {}),
      ...(anchorRegionSlug ? { anchorRegionSlug } : {}),
      slotIndex,
    });
    if (ok) enqueued++;
  }
  return enqueued;
}

async function processJob(_job: Job<{ readonly trigger: string }>): Promise<void> {
  // Kill switch check
  const killSwitch = await readContentGenConfig<KillSwitchState>("kill_switch", { active: false });
  if (killSwitch.active) {
    console.log("[orchestrator] kill switch active, skip tick");
    return;
  }

  const batchSettings = await readContentGenConfig<BatchSettings>("batches", {
    workersConcurrency: 3,
  });

  const runningCampaigns = await prisma.coverageCampaign.findMany({
    where: { status: "running" },
    orderBy: { createdAt: "asc" },
  });

  if (runningCampaigns.length === 0) {
    console.log("[orchestrator] no running campaigns, skip tick");
    return;
  }

  // 2026-06-15 — Fallback global d'intention de recherche : avant, une campagne
  // SANS searchIntentMix retombait toujours sur "informational" (réglage console
  // /settings/search-intent-distribution dormant, jamais lu). Désormais on l'utilise
  // comme distribution par défaut. Mapping vers les valeurs enum SearchIntent
  // (commercial → commercial_investigation). Appliqué en place aux campagnes
  // dépourvues de mix propre (leur mix per-campagne reste prioritaire).
  // Lecture directe de la config (clé `search_intent_distribution`) — PAS via
  // policies.ts (use-server → tire next-auth, casse le worker). Même clé/défauts.
  const intentDist = await readContentGenConfig<{
    informational?: number;
    commercial?: number;
    local?: number;
    transactional?: number;
    navigational?: number;
  }>("search_intent_distribution", {
    informational: 50,
    commercial: 25,
    local: 15,
    transactional: 5,
    navigational: 5,
  });
  const globalIntentMix: Partial<Record<SearchIntent, number>> = {
    informational: intentDist.informational ?? 0,
    commercial_investigation: intentDist.commercial ?? 0,
    local: intentDist.local ?? 0,
    transactional: intentDist.transactional ?? 0,
    navigational: intentDist.navigational ?? 0,
  };
  const hasGlobalIntent = Object.values(globalIntentMix).some((v) => (v ?? 0) > 0);
  for (const c of runningCampaigns) {
    if (hasGlobalIntent && c.searchIntentMix == null) {
      (c as { searchIntentMix: unknown }).searchIntentMix = globalIntentMix;
    }
  }

  // Sprint 7 V2 : si dailyTargetByType configuré, on dérive `perCampaignTick`
  // depuis les décisions anti-burst (somme des enqueueCount actuels). Sinon
  // fallback V2 = ceil(campaign.dailyArticles / 96) par campagne.
  const perTypeTargets = batchSettings.dailyTargetByType ?? {};
  const hasPerTypeMode = Object.values(perTypeTargets).some((v) => (v ?? 0) > 0);

  let tickBudget = 0;
  let perTypeDecisions: ReadonlyArray<{ contentType: ContentType; enqueueCount: number }> = [];
  if (hasPerTypeMode) {
    const startOfDayUtc = new Date();
    startOfDayUtc.setUTCHours(0, 0, 0, 0);
    const createdTodayRaw = await prisma.contentGenJob.groupBy({
      by: ["contentType"],
      where: { createdAt: { gte: startOfDayUtc }, status: { not: "cancelled" } },
      _count: { _all: true },
    });
    const createdTodayByType: Partial<Record<ContentType, number>> = {};
    for (const row of createdTodayRaw) {
      createdTodayByType[row.contentType as ContentType] = row._count._all;
    }
    perTypeDecisions = computeAntiBurstSchedule({
      targetByType: perTypeTargets,
      createdTodayByType,
      msSinceStartOfDay: msSinceStartOfDay(),
      antiBurstEnabled: batchSettings.antiBurstEnabled ?? true,
    });
    tickBudget = perTypeDecisions.reduce((sum, d) => sum + d.enqueueCount, 0);
    if (tickBudget === 0) {
      console.log("[orchestrator] per-type schedule says nothing to enqueue this tick");
      return;
    }
  }
  // !hasPerTypeMode → budget V2 per-campaign (dailyArticles / 96 ticks/day), computed in loop

  // Sprint 7 V2 : compteur résiduel par type pour distribuer entre campagnes
  const remainingByType: Partial<Record<ContentType, number>> = {};
  for (const d of perTypeDecisions) {
    remainingByType[d.contentType] = d.enqueueCount;
  }

  let totalEnqueued = 0;

  for (const campaign of runningCampaigns) {
    // Sprint Campaign Controls — skip si endDate dépassée (deadline-checker gère le passage completed)
    if (campaign.endDate && campaign.endDate <= new Date()) {
      console.log(`[orchestrator] campaign=${campaign.id} endDate passed, skip tick`);
      continue;
    }

    const remaining = campaign.totalTargetCount - campaign.generatedCount;
    if (remaining <= 0) {
      await prisma.coverageCampaign.update({
        where: { id: campaign.id },
        data: { status: "completed", completedAt: new Date() },
      });
      // P1-17 fix audit opérationnel — alerte Telegram "Campagne terminée".
      try {
        const stats = await prisma.contentGenJob.aggregate({
          where: { campaignId: campaign.id },
          _sum: { costUsd: true },
          _avg: { qualityScore: true },
        });
        const published = await prisma.contentGenJob.count({
          where: { campaignId: campaign.id, status: "published" },
        });
        const failed = await prisma.contentGenJob.count({
          where: { campaignId: campaign.id, status: "failed" },
        });
        void alertCampaignDone(
          campaign.name,
          campaign.id,
          campaign.totalTargetCount,
          Number(stats._sum.costUsd ?? 0),
          Number(stats._avg.qualityScore ?? 0),
          published,
          failed,
        ).catch(() => undefined);
      } catch {
        // best-effort
      }
      continue;
    }

    // V2 : budget par campagne — per-type ou per-campaign dailyArticles
    const perCampaignTick = hasPerTypeMode
      ? Math.max(1, Math.floor(tickBudget / runningCampaigns.length))
      : Math.max(1, Math.ceil(((campaign.dailyArticles ?? 30) as number) / 96));
    const toEnqueue = Math.min(perCampaignTick, remaining);
    const villeAnchors = await resolveVilleAnchors(campaign);

    // Sprint Campaign Controls — dispatch selon cityProcessingMode
    let enqueued: number;
    if (campaign.cityProcessingMode === "sequential") {
      enqueued = await processSequentialCampaign(
        campaign,
        toEnqueue,
        hasPerTypeMode,
        remainingByType,
        villeAnchors,
      );
    } else {
      enqueued = await processParallelCampaign(
        campaign,
        toEnqueue,
        hasPerTypeMode,
        remainingByType,
        undefined,
        villeAnchors,
      );
    }
    totalEnqueued += enqueued;

    // P1 2026-06-13 — Fix dérive : incrémenter du nombre RÉELLEMENT enqueué
    // (`enqueued`), pas du nombre visé (`toEnqueue`). En mode séquentiel, une
    // ville en cours retourne 0 ; l'ancien `toEnqueue` gonflait `generatedCount`
    // et marquait la campagne `completed` (remaining<=0) sans avoir atteint la
    // cible réelle. Skip l'update si rien n'a été produit (évite un write inutile).
    if (enqueued > 0) {
      await prisma.coverageCampaign.update({
        where: { id: campaign.id },
        data: { generatedCount: { increment: enqueued } },
      });
    }
  }

  console.log(
    `[orchestrator] tick OK — ${totalEnqueued} jobs enqueued across ${runningCampaigns.length} campaigns ` +
      `(mode=${hasPerTypeMode ? "per-type-antiburst" : "per-campaign-dailyArticles"}, tickBudget=${tickBudget})`,
  );
}

let workerInstance: Worker | null = null;

export function startOrchestratorWorker(): Worker {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — orchestrator-worker cannot start");
  workerInstance = new Worker(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 1,
    lockDuration: 120_000,
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-orchestrator-worker] job ${job?.id} failed:`, err);
    // Sprint S+4-C (audit content-gen deep 2026-05-18 P1-7) — Sentry capture
    // pour observer les fails du tick orchestrator (campaign scan + enqueue).
    // Volume tick = 1 toutes les 15 min → low cardinality, fingerprint stable.
    captureWorkerError("orchestrator", QUEUE_NAME, job, err);
  });
  return workerInstance;
}

export async function stopOrchestratorWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
  if (contentGenQueue) {
    await contentGenQueue.close();
    contentGenQueue = null;
  }
}
