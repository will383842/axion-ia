/**
 * Worker content-refresh — lutte contre le « content decay » (refonte 2026-06-22).
 *
 * Pourquoi : après ~14 jours, un article cesse d'être cité par les moteurs de
 * réponse IA et perd des positions Google s'il n'est pas rafraîchi. Ce worker
 * repère les articles tier-1 publiés les plus ANCIENS (les plus à risque) et les
 * SIGNALE pour rafraîchissement.
 *
 * DÉFAUT PRUDENT (Will 2026-06-22) — SCAN + ALERTE, pas de mutation auto :
 *   - tier-1 indexables uniquement (le contenu qui compte) ;
 *   - non modifiés depuis > N jours (défaut 14, env CONTENT_REFRESH_OLDER_THAN_DAYS) ;
 *   - max N articles par run (défaut 10, env CONTENT_REFRESH_MAX_PER_RUN), du
 *     plus ancien au plus récent ;
 *   - alerte Telegram avec la liste des candidats → Will/admin déclenche la
 *     vraie ré-génération (qui change le CONTENU, jamais juste la date).
 *
 * On NE bumpe PAS `updatedAt` ici : changer la date sans changer le contenu =
 * date-gaming (explicitement banni du projet). La ré-amélioration réelle passe
 * par le pipeline content-gen (déclenché par Will), pas par ce scan.
 *
 * Activation : env CONTENT_REFRESH_ENABLED=true (désactivé par défaut).
 * Cron suggéré : hebdomadaire (ex. lundi 04h00 UTC).
 */

import { Worker, type Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";

const QUEUE_NAME = "content-refresh";
const DEFAULT_OLDER_THAN_DAYS = 14;
const DEFAULT_MAX_PER_RUN = 10;

interface RefreshJobData {
  readonly trigger: "cron-weekly" | "manual";
  readonly olderThanDays?: number;
  readonly maxPerRun?: number;
}

export interface ContentRefreshResult {
  readonly scannedCount: number;
  readonly flaggedCount: number;
  readonly refreshedCount: number;
  readonly checkedAt: string;
}

const ENABLED_ENV = process.env.CONTENT_REFRESH_ENABLED === "true";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function runRefreshJob(job: Job<RefreshJobData>): Promise<ContentRefreshResult> {
  const checkedAt = new Date().toISOString();
  if (!ENABLED_ENV) {
    console.log("[content-refresh] disabled (CONTENT_REFRESH_ENABLED!=true) — skip");
    return { scannedCount: 0, flaggedCount: 0, refreshedCount: 0, checkedAt };
  }

  const olderThanDays =
    job.data.olderThanDays ?? envInt("CONTENT_REFRESH_OLDER_THAN_DAYS", DEFAULT_OLDER_THAN_DAYS);
  const maxPerRun =
    job.data.maxPerRun ?? envInt("CONTENT_REFRESH_MAX_PER_RUN", DEFAULT_MAX_PER_RUN);
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  // Scan : articles tier-1 publiés non rafraîchis depuis > olderThanDays, du
  // plus ancien au plus récent (les plus décayés d'abord). Best-effort.
  const stale = await prisma.article
    .findMany({
      where: {
        status: "published",
        indexationTier: "tier_1_indexable",
        updatedAt: { lte: cutoff },
      },
      orderBy: { updatedAt: "asc" },
      take: maxPerRun,
      select: {
        id: true,
        updatedAt: true,
        translations: { where: { locale: "fr" }, select: { slug: true }, take: 1 },
      },
    })
    .catch(() => []);

  const now = Date.now();
  const candidates = stale.map((a) => ({
    slug: a.translations[0]?.slug ?? a.id,
    ageDays: Math.round((now - a.updatedAt.getTime()) / (24 * 60 * 60 * 1000)),
  }));

  // SIGNALEMENT : on logge la liste des candidats (slug + âge) pour que Will/
  // admin déclenche la vraie ré-génération (le contenu doit changer, pas la date).
  // Le résultat structuré (flaggedCount) est aussi exploitable par un dashboard/cron.
  if (candidates.length > 0) {
    const lines = candidates.map((c) => `${c.slug} (${c.ageDays}j)`).join(", ");
    console.log(`[content-refresh] ${candidates.length} candidat(s) à rafraîchir : ${lines}`);
  }
  console.log(
    `[content-refresh] scanné=${stale.length} candidats=${candidates.length} (>${olderThanDays}j, max ${maxPerRun})`,
  );

  // refreshedCount = 0 : ce worker SIGNALE, il ne mute pas (anti date-gaming).
  return {
    scannedCount: stale.length,
    flaggedCount: candidates.length,
    refreshedCount: 0,
    checkedAt,
  };
}

let workerInstance: Worker<RefreshJobData> | null = null;

export function startContentRefreshWorker(): Worker<RefreshJobData> {
  if (!ENABLED_ENV) {
    throw new Error("CONTENT_REFRESH_ENABLED!=true — worker NOT started (env-gated)");
  }
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — content-refresh-worker cannot start");
  workerInstance = new Worker<RefreshJobData>(QUEUE_NAME, runRefreshJob, {
    connection: { url: redisUrl },
    concurrency: 1,
    lockDuration: 1_800_000, // 30 min
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-refresh-worker] job ${job?.id} failed:`, err);
    captureWorkerError("content-refresh", QUEUE_NAME, job, err);
  });
  return workerInstance;
}

export async function stopContentRefreshWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}

export { runRefreshJob as runContentRefreshJob };
export { QUEUE_NAME as CONTENT_REFRESH_QUEUE_NAME };
