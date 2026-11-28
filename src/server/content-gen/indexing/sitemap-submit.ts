/**
 * Soumission automatique du sitemap des articles à Google (API Search Console,
 * `sitemaps.submit`), regroupée : AU PLUS UNE FOIS PAR HEURE après une publication.
 *
 * Éteint par défaut : `GSC_SITEMAP_SUBMIT_ENABLED=true` pour l'allumer. La voie
 * « API Indexing » de Google est interdite aux articles ; celle-ci est la voie permise.
 *
 * Regroupement : un seul job BullMQ retardé (jobId fixe) ; plusieurs publications
 * pendant l'attente ne créent pas de second job. Le délai tient compte de la
 * dernière soumission (clé Redis) pour ne jamais dépasser 1 soumission / heure.
 * Fire-and-forget : ne throw jamais.
 */

import { Queue } from "bullmq";
import { redis } from "@/lib/redis";

export const SITEMAP_SUBMIT_QUEUE = "content-sitemap-submit";
export const SITEMAP_SUBMIT_DERNIERE_CLE = "gsc:sitemap-submit:derniere";
export const SITEMAP_SUBMIT_INTERVALLE_MS = 60 * 60 * 1000;
/** Petit délai pour regrouper une rafale de publications. */
export const SITEMAP_SUBMIT_REGROUPEMENT_MS = 2 * 60 * 1000;
const JOB_ID = "gsc-sitemap-submit-en-attente";

export function soumissionSitemapActive(): boolean {
  return process.env.GSC_SITEMAP_SUBMIT_ENABLED === "true";
}

export function urlSitemapArticles(): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com").replace(/\/$/, "");
  return `${base}/sitemap-blog.xml`;
}

/** Délai avant la soumission : regroupement, ou reste de l'heure depuis la dernière. */
export function delaiAvantSoumission(derniereMs: number | null, maintenantMs: number): number {
  if (derniereMs === null || !Number.isFinite(derniereMs)) return SITEMAP_SUBMIT_REGROUPEMENT_MS;
  const reste = derniereMs + SITEMAP_SUBMIT_INTERVALLE_MS - maintenantMs;
  return Math.max(SITEMAP_SUBMIT_REGROUPEMENT_MS, reste);
}

let queue: Queue | null = null;
function getQueue(): Queue | null {
  if (queue) return queue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  queue = new Queue(SITEMAP_SUBMIT_QUEUE, { connection: { url: redisUrl } });
  return queue;
}

export async function planifierSoumissionSitemap(now: number = Date.now()): Promise<boolean> {
  if (!soumissionSitemapActive()) return false;
  try {
    const q = getQueue();
    if (!q) return false;
    const brut = await redis.get(SITEMAP_SUBMIT_DERNIERE_CLE);
    const derniere = brut ? Number(brut) : null;
    await q.add(
      "submit",
      { sitemap: urlSitemapArticles() },
      {
        jobId: JOB_ID,
        delay: delaiAvantSoumission(derniere, now),
        removeOnComplete: true,
        removeOnFail: true,
        attempts: 1,
      },
    );
    return true;
  } catch (err) {
    console.warn(
      "[sitemap-submit] planification impossible (best-effort) :",
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

export function _resetSitemapSubmitQueueForTest(): void {
  queue = null;
}
