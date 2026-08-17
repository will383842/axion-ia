/**
 * Content Generator — Tier lifecycle worker (Sprint 10 V2).
 *
 * Cron mensuel 15 du mois 06:00 UTC (`bootRepeatableJobs` queues.ts).
 *
 * Pipeline :
 *  1. Pick Articles tier-2 publiés ≥ 30j (promote candidates)
 *  2. Pick Articles tier-1 publiés ≥ 60j (demote candidates)
 *  3. Pour chaque : fetch CTR via GSC (skeleton V1 = null) → compute decision
 *  4. Apply : promote / demote / noop selon décision
 *  5. Log dans console + GenerationLog (audit trail)
 *
 * V1 SKELETON : sans credentials GSC, le worker tourne mais retourne 0
 * action (tous noop "no_data"). Activation full = Sprint 10.5.
 */

import { Worker, type Job } from "bullmq";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { prisma } from "@/lib/prisma";
import {
  computeTierDecision,
  DEFAULT_TIER_THRESHOLDS,
  type IndexationTier,
} from "@/server/content-gen/lifecycle/tier-decisions";
import { fetchSearchConsoleCtr } from "@/server/content-gen/lifecycle/analytics-clients";
import { enqueueIndexingForTier1 } from "@/server/content-gen/indexing/enqueue";
import { buildArticleUrl, buildArticlePath } from "@/server/content-gen/indexing/url-builder";
// Fix 2026-08-15 (D9 audit e2e) — revalidation ISR de la page démotée via l'API
// interne (revalidatePath direct = no-op en worker bg, cf. P1-16).
import { revalidateContent } from "@/server/content-gen/shared/revalidate-content";
import { readContentGenConfig } from "@/server/actions/content-gen/_settings";
import { alertTier3Stagnant } from "@/server/content-gen/shared/content-gen-alerts";

const QUEUE_NAME = "content-tier-lifecycle";
const PROMOTE_AGE_DAYS = DEFAULT_TIER_THRESHOLDS.promoteAgeDaysMin;
const DEMOTE_AGE_DAYS = DEFAULT_TIER_THRESHOLDS.demoteAgeDaysMin;
// Audit indexation 2026-05-18 — fenêtres CTR alignées sur nouveaux seuils
// promoteAgeDaysMin=14 + demoteAgeDaysMin=30 (cf. tier-decisions.ts).
const PROMOTE_WINDOW_DAYS = 14;
const DEMOTE_WINDOW_DAYS = 30;
// Audit indexation 2026-05-18 — batch ×5 (200 → 1000) pour daily cron.
// À 500/jour publié, pool tier-2 = 15K/mois → scan complet ~2 semaines.
const MAX_BATCH_PER_RUN = 1000;

interface RunStats {
  scanned: number;
  promoted: number;
  demoted: number;
  noop: number;
  noData: number;
}

async function applyPromote(
  articleId: string,
  slug: string,
  isNews: boolean,
  templateVariant: string | null,
  reason: string,
): Promise<void> {
  await prisma.article.update({
    where: { id: articleId },
    data: {
      indexationTier: "tier_1_indexable" as IndexationTier,
      promotedAt: new Date(),
    },
  });
  // Fix 2026-08-15 (D8) — templateVariant propagé pour que les guides soient
  // pingés sous /fr/guides/… (et non /fr/blog/… qui 308).
  await enqueueIndexingForTier1({
    articleId,
    slug,
    isNews,
    templateVariant,
    origin: "tier-promote",
  });
  console.log(`[tier-lifecycle] PROMOTE article=${articleId} reason=${reason}`);
}

async function applyDemote(
  articleId: string,
  slug: string,
  isNews: boolean,
  templateVariant: string | null,
  reason: string,
): Promise<void> {
  await prisma.article.update({
    where: { id: articleId },
    data: {
      indexationTier: "tier_2_noindex_follow" as IndexationTier,
      promotedAt: null,
    },
  });
  // Fix 2026-08-15 (D9 audit e2e) — revalider la page AVANT le ping. Sans ça,
  // le meta `noindex` n'apparaissait qu'à l'expiration ISR (≤ 1 h) alors que le
  // ping `URL_UPDATED` partait immédiatement : Google pouvait re-crawler une
  // page qui servait encore `index,follow` — le demote était invisible pour le
  // crawler. Best-effort (revalidateContent ne throw jamais) ; l'échec est
  // journalisé (D1) — la page se rattrapera à l'expiration ISR.
  const demotedPath = buildArticlePath({ slug, isNews, templateVariant });
  const reval = await revalidateContent({
    // Les sitemaps aussi : un tier-2 sort du sitemap, l'index ISR doit suivre.
    paths: [demotedPath, "/sitemap.xml", "/sitemap-index.xml"],
  });
  if (!reval.ok) {
    console.error(
      `[tier-lifecycle] revalidation ISR échouée pour ${demotedPath} (${reval.reason ?? "unknown"}) — noindex visible à l'expiration ISR`,
    );
  }
  // Anti-yoyo (audit indexation 2026-06-17, décision Will) : un demote de tier ne
  // SUPPRIME pas la page (elle reste 200 en ligne, juste noindex,follow). On ne doit
  // donc JAMAIS émettre `URL_DELETED` (= demande de suppression définitive Google/Bing)
  // sur un simple demote — réservé à l'archivage/suppression réel (cf. actions KB
  // delete-entry / _transition). On signale un simple `URL_UPDATED`.
  // Fix 2026-08-15 (D9) — commentaire périmé corrigé : depuis le P4 élagage
  // (décision Will 2026-06-21), le publish ne pose PLUS `promotedAt` à la
  // naissance tier-1 → ce chemin n'est PAS inerte : c'est LA voie normale de
  // démotion des sous-performants chroniques dès que les creds GSC sont
  // branchés (`promotedAt` reste réservé à une future protection manuelle).
  await enqueueIndexingForTier1({
    articleId,
    slug,
    isNews,
    templateVariant,
    origin: "tier-promote",
    lifecycleEvent: "update",
  });
  console.log(`[tier-lifecycle] DEMOTE article=${articleId} reason=${reason}`);
}

async function processArticles(
  tier: IndexationTier,
  publishedBefore: Date,
  windowDays: number,
  stats: RunStats,
): Promise<void> {
  const candidates = await prisma.article.findMany({
    where: {
      status: "published",
      indexationTier: tier,
      publishedAt: { lte: publishedBefore },
    },
    include: { translations: { where: { locale: "fr" } } },
    take: MAX_BATCH_PER_RUN,
    orderBy: { publishedAt: "asc" },
  });

  stats.scanned += candidates.length;

  for (const article of candidates) {
    const t = article.translations[0];
    if (!t) continue;
    // Fix 2026-08-15 (D8 audit e2e) — templateVariant propagé : un article
    // GUIDE interrogé sur l'URL /fr/blog/guide-… (308 → /fr/guides/…) avait des
    // métriques GSC NULLES à vie → décisions promote/demote toujours no_data.
    const templateVariant = article.templateVariant ?? null;
    const url = buildArticleUrl({ slug: t.slug, isNews: article.isNews, templateVariant });
    const metrics = await fetchSearchConsoleCtr(url, windowDays);
    const ageDays = article.publishedAt
      ? Math.floor((Date.now() - article.publishedAt.getTime()) / 86_400_000)
      : 0;

    const decision = computeTierDecision({
      currentTier: article.indexationTier as IndexationTier,
      ageDays,
      ctr: metrics?.ctr ?? null,
      impressions: metrics?.impressions ?? null,
      wasManuallyPromoted: article.promotedAt !== null,
    });

    if (decision.action === "promote" && decision.nextTier === "tier_1_indexable") {
      await applyPromote(article.id, t.slug, article.isNews, templateVariant, decision.reason);
      stats.promoted++;
    } else if (decision.action === "demote") {
      await applyDemote(article.id, t.slug, article.isNews, templateVariant, decision.reason);
      stats.demoted++;
    } else if (decision.reason === "no_data") {
      stats.noData++;
    } else {
      stats.noop++;
    }
  }
}

async function processJob(_job: Job<{ readonly trigger: string }>): Promise<void> {
  // Audit 2026-05-15 P1-8 — kill-switch check (modifie indexationTier sur
  // articles publiés, important d'arrêter avant promote/demote en masse).
  const killSwitch = await readContentGenConfig<{ active: boolean }>("kill_switch", {
    active: false,
  });
  if (killSwitch.active) {
    console.log("[tier-lifecycle] kill switch active, skip run");
    return;
  }

  const stats: RunStats = { scanned: 0, promoted: 0, demoted: 0, noop: 0, noData: 0 };
  const now = Date.now();
  const promoteThreshold = new Date(now - PROMOTE_AGE_DAYS * 86_400_000);
  const demoteThreshold = new Date(now - DEMOTE_AGE_DAYS * 86_400_000);

  await processArticles("tier_2_noindex_follow", promoteThreshold, PROMOTE_WINDOW_DAYS, stats);
  await processArticles("tier_1_indexable", demoteThreshold, DEMOTE_WINDOW_DAYS, stats);

  // Méta-cert 2026-05-15 AGENT 19 P1 — câbler alertTier3Stagnant (helper
  // ready-to-call déclaré mais jamais invoqué). Trigger info avant purge auto.
  const STAGNANT_THRESHOLD_DAYS = 90;
  const stagnantBefore = new Date(now - STAGNANT_THRESHOLD_DAYS * 86_400_000);
  const stagnantTier3 = await prisma.article.findMany({
    where: {
      status: "published",
      indexationTier: "tier_3_noindex_nofollow" as IndexationTier,
      publishedAt: { lte: stagnantBefore },
    },
    select: { publishedAt: true },
    orderBy: { publishedAt: "asc" },
  });
  if (stagnantTier3.length > 0) {
    const oldest = stagnantTier3[0]?.publishedAt;
    const oldestAgeDays = oldest
      ? Math.floor((now - oldest.getTime()) / 86_400_000)
      : STAGNANT_THRESHOLD_DAYS;
    await alertTier3Stagnant(stagnantTier3.length, oldestAgeDays);
  }

  console.log(
    `[tier-lifecycle] run done — scanned=${stats.scanned} promoted=${stats.promoted} ` +
      `demoted=${stats.demoted} noop=${stats.noop} no_data=${stats.noData} ` +
      `tier3_stagnant=${stagnantTier3.length}`,
  );
}

let workerInstance: Worker | null = null;

export function startTierLifecycleWorker(): Worker {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — tier-lifecycle-worker cannot start");
  workerInstance = new Worker(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 1,
    lockDuration: 120_000,
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-tier-lifecycle-worker] job ${job?.id} failed:`, err);
    captureWorkerError("tier-lifecycle", QUEUE_NAME, job, err);
  });
  return workerInstance;
}

export async function stopTierLifecycleWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
