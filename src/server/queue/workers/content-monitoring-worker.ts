/**
 * Content monitoring worker — Méta-cert 2026-05-15 AGENT 19 P1.
 *
 * Câble 3 helpers Telegram ready-to-call déclarés dans
 * `content-gen-alerts.ts` mais jamais invoqués jusqu'ici :
 *
 *  1. `alertQueueStuck(queueName, waitingCount, minutesStuck)` —
 *     inspecte BullMQ `getWaitingCount()` sur les queues critiques et
 *     compare avec la valeur snapshot précédente stockée dans
 *     `ContentGenConfig.queue_stuck_snapshots`. Si même count > 30 min
 *     sans progression → alerte.
 *
 *  2. `alertSoft404Detected(slug, reason)` — link-checker daily-ish (les
 *     hourly runs ne checkent qu'un sample 10 URLs random tier_1 pour ne
 *     pas saturer). HEAD request → soft-404 = 200 avec body anormalement
 *     court (template vide / page de redirection silencieuse).
 *
 *  3. `alertIndexationStagnant(slugs, daysSincePublish)` — détecte Articles
 *     tier_1_indexable publiés ≥ 30 j sans `gscIndexedAt` set (signe
 *     d'absence d'indexation Google malgré ping IndexNow + sitemap).
 *
 * Cron pattern : `15 * * * *` (xx:15 every hour). Décalé d'autres crons
 * pour ne pas concentrer la charge.
 *
 * Fail-soft : chaque check est dans son try/catch. Une erreur sur queueStuck
 * n'empêche pas soft404 + indexationStagnant de tourner.
 *
 * Note V1.5 — `alertProviderDown5min/30min` non câblé ici : nécessite un
 * compteur fail-counter dans le call provider lui-même (cost-tracker ou
 * IProvider wrapper), pas un cron périodique. Sprint dédié.
 */

import { Worker, type Job } from "bullmq";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { prisma } from "@/lib/prisma";
import {
  alertQueueStuck,
  alertSoft404Detected,
  alertIndexationStagnant,
  alertCityEquityImbalance,
} from "@/server/content-gen/shared/content-gen-alerts";
import { ssrfSafeFetch } from "@/lib/ssrf-safe-fetch";

const QUEUE_NAME = "content-monitoring";

/** Queues critiques à monitorer (waiting count stable > 30 min = stuck). */
const MONITORED_QUEUES: ReadonlyArray<string> = [
  "content-gen",
  "content-publish",
  "content-orchestrator",
  "emails",
];

/** Seuil de stagnation queue : > 30 min sans progression. */
const QUEUE_STUCK_MINUTES = 30;

/** Sample size soft-404 par run (HEAD checks). */
const SOFT404_SAMPLE_SIZE = 10;

/** Body length threshold sous lequel on flagge soft-404 (HTML vide / template). */
const SOFT404_BODY_MIN_BYTES = 2000;

/** Seuil indexation stagnante : Article tier_1 publié ≥ 30 j sans gscIndexedAt. */
const INDEXATION_STAGNANT_DAYS = 30;

/** Cap nombre d'articles flag pour alerte (pour ne pas spammer). */
const INDEXATION_STAGNANT_MAX_LIST = 5;

interface QueueSnapshot {
  readonly count: number;
  readonly capturedAt: string; // ISO
}

/**
 * Snapshots persistés dans Redis sous `axion:monitoring:queue-snapshot:<queueName>`.
 * TTL 3 h (assez pour traverser 2 cycles cron sans expirer + auto-cleanup).
 * Évite d'écrire dans `ContentGenConfig` qui exige `requireAdmin()` (incompat worker).
 */
const SNAPSHOT_TTL_SECONDS = 3 * 3600;
const SNAPSHOT_KEY_PREFIX = "axion:monitoring:queue-snapshot:";

async function checkQueueStuck(): Promise<void> {
  const Redis = (await import("ioredis")).default;
  const url = process.env.REDIS_URL;
  if (!url) return;
  const redis = new Redis(url, { maxRetriesPerRequest: 1, enableReadyCheck: false });

  try {
    const now = new Date();
    for (const queueName of MONITORED_QUEUES) {
      try {
        // BullMQ stocke les jobs waiting dans la liste `bull:<queue>:wait`.
        const count = await redis.llen(`bull:${queueName}:wait`);
        const snapshotKey = `${SNAPSHOT_KEY_PREFIX}${queueName}`;
        const prevJson = await redis.get(snapshotKey);
        const previous: QueueSnapshot | null = prevJson
          ? (JSON.parse(prevJson) as QueueSnapshot)
          : null;
        if (previous && previous.count === count && count > 0) {
          const previousAt = new Date(previous.capturedAt);
          const minutesStuck = Math.floor((now.getTime() - previousAt.getTime()) / 60_000);
          if (minutesStuck >= QUEUE_STUCK_MINUTES) {
            await alertQueueStuck(queueName, count, minutesStuck);
            // Reset le snapshot pour éviter de spammer une alerte chaque heure.
            const next: QueueSnapshot = { count, capturedAt: now.toISOString() };
            await redis.set(snapshotKey, JSON.stringify(next), "EX", SNAPSHOT_TTL_SECONDS);
            continue;
          }
          // Pas encore stuck — on garde le snapshot d'origine pour suivre la durée.
          continue;
        }
        const next: QueueSnapshot = { count, capturedAt: now.toISOString() };
        await redis.set(snapshotKey, JSON.stringify(next), "EX", SNAPSHOT_TTL_SECONDS);
      } catch (err) {
        console.warn(`[content-monitoring] queueStuck check failed for ${queueName}:`, err);
      }
    }
  } finally {
    redis.disconnect();
  }
}

async function checkSoft404(): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  // Article.slug n'existe pas directement — c'est dans `ArticleTranslation`
  // par locale. On lookup les translations FR (canonique) d'Articles tier_1.
  const candidates = await prisma.articleTranslation.findMany({
    where: {
      locale: "fr",
      article: {
        status: "published",
        indexationTier: "tier_1_indexable",
      },
    },
    select: {
      slug: true,
      article: { select: { isNews: true } },
    },
    take: SOFT404_SAMPLE_SIZE * 3, // sample-then-shuffle pour randomness léger
  });
  if (candidates.length === 0) return;

  // Shuffle Fisher-Yates puis prend SOFT404_SAMPLE_SIZE premiers.
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = shuffled[i];
    const swap = shuffled[j];
    if (tmp && swap) {
      shuffled[i] = swap;
      shuffled[j] = tmp;
    }
  }
  const sample = shuffled.slice(0, SOFT404_SAMPLE_SIZE);

  for (const t of sample) {
    const segment = t.article.isNews ? "actualites" : "blog";
    const url = `${siteUrl}/fr/${segment}/${t.slug}`;
    try {
      const res = await ssrfSafeFetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue; // 4xx/5xx ≠ soft-404, c'est un hard error géré ailleurs
      const text = await res.text();
      if (text.length < SOFT404_BODY_MIN_BYTES) {
        await alertSoft404Detected(t.slug, `body too short (${text.length} bytes)`);
      }
    } catch {
      // fail-soft — timeout, DNS, etc. ne déclenchent pas l'alerte.
    }
  }
}

async function checkIndexationStagnant(): Promise<void> {
  // ⛔ DÉSACTIVÉ PAR DÉFAUT 2026-07-11 : cette alerte tournait toutes les heures
  // (cron `15 * * * *`) et re-notifiait Telegram sans anti-répétition pour les
  // mêmes articles, avec des CTR/impressions PLACEHOLDER codés en dur à 0
  // (l'intégration Search Console "V1.5" n'a jamais été faite). Résultat : spam
  // horaire non actionnable ("CTR 0.00 % sur 0 impressions"). Détection conservée.
  // POUR RÉACTIVER : brancher une vraie source GSC (ctrPct/impressions réels) +
  // ajouter un cooldown par slug (Redis SETEX, ex. 30 j), PUIS poser l'env var
  // INDEXATION_STAGNANT_ALERT_ENABLED=true côté Coolify.
  if (process.env.INDEXATION_STAGNANT_ALERT_ENABLED !== "true") return;

  // Heuristique V1 sans field `gscIndexedAt` dédié : un Article tier_1
  // publié ≥ 30 j sans AUCUN row `KeywordTracking` correspondant via articleId
  // est suspect — soit non indexé Google, soit 0 impression.
  // V1.5 ajoutera `Article.gscIndexedAt` pour un signal plus fin.
  const threshold = new Date(Date.now() - INDEXATION_STAGNANT_DAYS * 86_400_000);
  const candidates = await prisma.article.findMany({
    where: {
      status: "published",
      indexationTier: "tier_1_indexable",
      publishedAt: { lte: threshold },
    },
    select: {
      id: true,
      publishedAt: true,
      translations: { where: { locale: "fr" }, select: { slug: true }, take: 1 },
    },
    orderBy: { publishedAt: "asc" },
    take: 50, // cap large puis filter local
  });
  if (candidates.length === 0) return;

  const stagnant: Array<{ slug: string; publishedAt: Date }> = [];
  for (const article of candidates) {
    if (stagnant.length >= INDEXATION_STAGNANT_MAX_LIST) break;
    const trackingCount = await prisma.keywordTracking.count({
      where: { articleId: article.id },
    });
    const slug = article.translations[0]?.slug;
    if (trackingCount === 0 && article.publishedAt && slug) {
      stagnant.push({ slug, publishedAt: article.publishedAt });
    }
  }
  if (stagnant.length === 0) return;
  // `alertIndexationStagnant(slug, ctrPct, ageDays, impressions)` attend 1 slug
  // par appel. CTR + impressions = 0 placeholder car GSC integration V1.5
  // fournira les vrais chiffres. V1 = simple detection "tier-1 sans KeywordTracking".
  for (const s of stagnant) {
    const daysSince = Math.floor((Date.now() - s.publishedAt.getTime()) / 86_400_000);
    await alertIndexationStagnant(s.slug, 0, daysSince, 0);
  }
}

/**
 * P0-2 Sprint correctif admin — Reset une alerte résolue (active: false).
 * Appelé quand la condition anormale n'est plus détectée, pour éviter que le
 * bandeau layout reste affiché indéfiniment sur une alerte périmée.
 */
async function resolveAnomaly(key: string): Promise<void> {
  await prisma.contentGenConfig
    .updateMany({
      where: { key },
      data: {
        value: { active: false, resolvedAt: new Date().toISOString() },
        updatedBy: "content-monitoring-worker",
      },
    })
    .catch(() => {});
}

// P0-3 Sprint P5 follow-up — Anomaly detection business (D-P5-7 A5-07).
// 3 checks business lancés toutes les 15 min via cron content-monitoring.
// Fail-soft : erreur Prisma n'interrompt pas les autres checks.
async function checkAnomalies(): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  // Check 1 : chute score qualite > 15 pts sur 1h vs heure precedente
  const [recentQ, prevQ] = await Promise.all([
    prisma.contentGenJob
      .aggregate({
        _avg: { qualityScore: true },
        where: { qualityScore: { not: null }, completedAt: { gte: oneHourAgo } },
      })
      .catch(() => ({ _avg: { qualityScore: null } })),
    prisma.contentGenJob
      .aggregate({
        _avg: { qualityScore: true },
        where: { qualityScore: { not: null }, completedAt: { gte: twoHoursAgo, lt: oneHourAgo } },
      })
      .catch(() => ({ _avg: { qualityScore: null } })),
  ]);
  if (recentQ._avg.qualityScore != null && prevQ._avg.qualityScore != null) {
    const drop = prevQ._avg.qualityScore - recentQ._avg.qualityScore;
    if (drop > 15) {
      await prisma.contentGenConfig
        .upsert({
          where: { key: "alert_quality_drop" },
          create: {
            key: "alert_quality_drop",
            value: {
              active: true,
              value: drop,
              detectedAt: new Date().toISOString(),
              message: `Chute qualite : -${drop.toFixed(1)} pts sur 1h`,
            },
            updatedBy: "content-monitoring-worker",
          },
          update: {
            value: {
              active: true,
              value: drop,
              detectedAt: new Date().toISOString(),
              message: `Chute qualite : -${drop.toFixed(1)} pts sur 1h`,
            },
            updatedBy: "content-monitoring-worker",
          },
        })
        .catch(() => {});
      console.warn(`[content-monitoring] ALERT quality_drop=${drop.toFixed(1)}`);
    } else {
      // Condition résolue — désactiver l'alerte si elle était active.
      await resolveAnomaly("alert_quality_drop");
    }
  }

  // Check 2 : taux rejet > 50% sur 1h
  const [totalRecent, failedRecent] = await Promise.all([
    prisma.contentGenJob.count({ where: { completedAt: { gte: oneHourAgo } } }).catch(() => 0),
    prisma.contentGenJob
      .count({ where: { status: "failed", completedAt: { gte: oneHourAgo } } })
      .catch(() => 0),
  ]);
  if (totalRecent > 5 && failedRecent / totalRecent > 0.5) {
    const pct = Math.round((failedRecent / totalRecent) * 100);
    await prisma.contentGenConfig
      .upsert({
        where: { key: "alert_reject_spike" },
        create: {
          key: "alert_reject_spike",
          value: {
            active: true,
            value: pct,
            detectedAt: new Date().toISOString(),
            message: `Spike rejets : ${failedRecent}/${totalRecent} (${pct}%) sur 1h`,
          },
          updatedBy: "content-monitoring-worker",
        },
        update: {
          value: {
            active: true,
            value: pct,
            detectedAt: new Date().toISOString(),
            message: `Spike rejets : ${failedRecent}/${totalRecent} (${pct}%) sur 1h`,
          },
          updatedBy: "content-monitoring-worker",
        },
      })
      .catch(() => {});
    console.warn(`[content-monitoring] ALERT reject_spike=${failedRecent}/${totalRecent}`);
  } else {
    // Condition résolue — désactiver l'alerte si elle était active.
    await resolveAnomaly("alert_reject_spike");
  }

  // Check 3 : 0 jobs crees depuis 4h sur campagne running
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const [runningCampaigns, recentJobs] = await Promise.all([
    prisma.coverageCampaign.count({ where: { status: "running" } }).catch(() => 0),
    prisma.contentGenJob.count({ where: { createdAt: { gte: fourHoursAgo } } }).catch(() => 0),
  ]);
  /**
   * Le texte affiché dans le bandeau rouge de `/content-gen`. Il disait
   * « Pipeline bloque : 1 campagne(s) running, 0 job cree depuis 4h » —
   * deux accents manquants, deux mots anglais et un pluriel entre
   * parenthèses, à l'endroit précis où l'on annonce à l'exploitant que sa
   * chaîne de production est à l'arrêt.
   *
   * ⚠️ Le texte d'une alerte est FIGÉ à sa création : cette correction ne
   * change QUE les alertes émises à partir de maintenant. Celle qui est
   * affichée aujourd'hui gardera son ancien libellé jusqu'à sa résolution.
   */
  const messagePipelineBloque = (campagnes: number): string =>
    campagnes > 1
      ? `Chaîne de production à l'arrêt : ${campagnes} campagnes en cours, aucune génération lancée depuis 4 h.`
      : `Chaîne de production à l'arrêt : 1 campagne en cours, aucune génération lancée depuis 4 h.`;

  if (runningCampaigns > 0 && recentJobs === 0) {
    await prisma.contentGenConfig
      .upsert({
        where: { key: "alert_pipeline_stall" },
        create: {
          key: "alert_pipeline_stall",
          value: {
            active: true,
            runningCampaigns,
            detectedAt: new Date().toISOString(),
            message: messagePipelineBloque(runningCampaigns),
          },
          updatedBy: "content-monitoring-worker",
        },
        update: {
          value: {
            active: true,
            runningCampaigns,
            detectedAt: new Date().toISOString(),
            message: messagePipelineBloque(runningCampaigns),
          },
          updatedBy: "content-monitoring-worker",
        },
      })
      .catch(() => {});
    console.warn(`[content-monitoring] ALERT pipeline_stall campaigns=${runningCampaigns}`);
  } else {
    // Condition résolue — désactiver l'alerte si elle était active.
    await resolveAnomaly("alert_pipeline_stall");
  }
}

/**
 * Détecte les campagnes ville running depuis ≥7j avec >30% des villes sans
 * aucun contenu généré — signe d'un déséquilibre géographique (Tier 1 saturé,
 * Tier 3/4 ignorés). Alerte Telegram + upsert ContentGenConfig pour bandeau admin.
 */
async function checkCityEquity(): Promise<void> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);
  const runningCampaigns = await prisma.coverageCampaign
    .findMany({
      where: { status: "running", startedAt: { lte: sevenDaysAgo }, scope: "ville" },
      select: { id: true, name: true, anchorVilleSlugs: true },
    })
    .catch(() => []);

  for (const campaign of runningCampaigns) {
    if (campaign.anchorVilleSlugs.length === 0) continue;

    const jobsByCity = await prisma.contentGenJob
      .groupBy({
        by: ["anchorVilleSlug"],
        where: {
          campaignId: campaign.id,
          anchorVilleSlug: { in: campaign.anchorVilleSlugs },
          status: { not: "cancelled" },
        },
        _count: { _all: true },
      })
      .catch(() => []);

    const covered = new Set(
      jobsByCity.filter((j) => j.anchorVilleSlug !== null).map((j) => j.anchorVilleSlug!),
    );
    const zeroCitiesCount = campaign.anchorVilleSlugs.filter((s) => !covered.has(s)).length;
    const ratio = zeroCitiesCount / campaign.anchorVilleSlugs.length;

    if (ratio > 0.3 && zeroCitiesCount >= 3) {
      await prisma.contentGenConfig
        .upsert({
          where: { key: "alert_city_equity" },
          create: {
            key: "alert_city_equity",
            value: {
              active: true,
              campaignId: campaign.id,
              campaignName: campaign.name,
              zeroCitiesCount,
              totalCities: campaign.anchorVilleSlugs.length,
              detectedAt: new Date().toISOString(),
              message: `Déséquilibre villes : ${zeroCitiesCount}/${campaign.anchorVilleSlugs.length} villes sans contenu`,
            },
            updatedBy: "content-monitoring-worker",
          },
          update: {
            value: {
              active: true,
              campaignId: campaign.id,
              campaignName: campaign.name,
              zeroCitiesCount,
              totalCities: campaign.anchorVilleSlugs.length,
              detectedAt: new Date().toISOString(),
              message: `Déséquilibre villes : ${zeroCitiesCount}/${campaign.anchorVilleSlugs.length} villes sans contenu`,
            },
            updatedBy: "content-monitoring-worker",
          },
        })
        .catch(() => {});
      void alertCityEquityImbalance(
        campaign.id,
        campaign.name,
        zeroCitiesCount,
        campaign.anchorVilleSlugs.length,
      ).catch(() => undefined);
      console.warn(
        `[content-monitoring] ALERT city_equity campaign=${campaign.id} zero=${zeroCitiesCount}/${campaign.anchorVilleSlugs.length}`,
      );
    } else {
      await resolveAnomaly("alert_city_equity");
    }
  }
}

/**
 * F6 complément (Fix 2026-08-15, audit e2e) — le bandeau « coût 80/100 % »
 * (`cost_cap_80_active`) est écrit `active:true` par le cost-tracker mais
 * n'était JAMAIS repassé à false : alerte périmée affichée indéfiniment dans
 * les layouts admin → accoutumance. Le reset mensuel l'éteint désormais
 * (cf. `resetMonthlyCostCounters`), et ce check couvre l'autre cas : un admin
 * qui relève le cap (ou remet le compteur) en cours de mois. Si la dépense du
 * provider concerné est repassée sous 80 % du cap, on résout l'alerte via le
 * même `resolveAnomaly` que les autres bandeaux.
 */
async function checkCostCapBannerStale(): Promise<void> {
  const row = await prisma.contentGenConfig
    .findUnique({ where: { key: "cost_cap_80_active" } })
    .catch(() => null);
  const value = row?.value as { active?: boolean; provider?: string } | null;
  if (value?.active !== true || !value.provider) return;

  const config = await prisma.providerConfig
    .findUnique({
      where: { provider: value.provider as never },
      select: { monthlyCapUsd: true, currentMonthSpentUsd: true },
    })
    .catch(() => null);
  if (!config) return;

  const cap = Number(config.monthlyCapUsd);
  const spent = Number(config.currentMonthSpentUsd);
  // Condition disparue (cap relevé, compteur remis à 0) → bandeau résolu.
  if (cap <= 0 || spent < cap * 0.8) {
    await resolveAnomaly("cost_cap_80_active");
    console.log(
      `[content-monitoring] cost_cap_80_active résolu (provider=${value.provider}, spent=${spent.toFixed(2)}/${cap.toFixed(2)})`,
    );
  }
}

async function processJob(job: Job<{ readonly trigger: string }>): Promise<void> {
  // Checks en parallèle (Promise.allSettled : un fail n'en bloque pas d'autres).
  //
  // Fix 2026-08-15 (audit e2e, F4) — les résultats étaient IGNORÉS : un check
  // qui rejetait disparaissait sans log ni Sentry, et le handler `failed` du
  // worker ne se déclenchait jamais (allSettled ne rejette pas). Le moniteur ne
  // se surveillait donc pas lui-même. On garde l'isolation (un check en échec
  // ne fait PAS échouer le tick — les autres checks ont tourné), mais chaque
  // rejet est désormais journalisé ET remonté à Sentry pour rougir quelque part.
  const checks: ReadonlyArray<readonly [string, Promise<void>]> = [
    ["queueStuck", checkQueueStuck()],
    ["soft404", checkSoft404()],
    ["indexationStagnant", checkIndexationStagnant()],
    ["anomalies", checkAnomalies()],
    ["cityEquity", checkCityEquity()],
    ["costCapBannerStale", checkCostCapBannerStale()],
  ];
  const results = await Promise.allSettled(checks.map(([, p]) => p));
  results.forEach((result, i) => {
    if (result.status !== "rejected") return;
    const checkName = checks[i]?.[0] ?? `check#${i}`;
    const cause = result.reason instanceof Error ? result.reason : new Error(String(result.reason));
    // Le nom du check est préfixé dans le message (et non dans le workerName,
    // typé union `WorkerName`) — il entre ainsi dans le fingerprint Sentry, qui
    // groupe par les 100 premiers caractères du message.
    const err = new Error(`check ${checkName} failed: ${cause.message}`, { cause });
    console.error(`[content-monitoring] check ${checkName} FAILED:`, cause);
    captureWorkerError("content-monitoring", QUEUE_NAME, job, err);
  });
}

let workerInstance: Worker | null = null;

export function startContentMonitoringWorker(): Worker {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — content-monitoring-worker cannot start");
  workerInstance = new Worker(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 1,
    lockDuration: 120_000,
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-monitoring-worker] job ${job?.id} failed:`, err);
    captureWorkerError("content-monitoring", QUEUE_NAME, job, err);
  });
  return workerInstance;
}

export async function stopContentMonitoringWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
