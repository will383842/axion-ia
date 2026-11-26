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
import { redis } from "@/lib/redis";
import { SITE_URL } from "@/lib/site-url";
import {
  isRoutableArticleSlug,
  resolveArticleRoute,
} from "@/server/content-gen/blog/resolve-article-route";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { gscInspectUrl, gscPageMetricsForUrl } from "@/server/content-gen/seo/gsc-client";
import { equipeEditorialeActive } from "@/server/content-gen/equipe/maillage";
import {
  choisirCandidatsMiseAJour,
  estCannibalise,
  suivreArticles,
  controlerLiensArticles,
  type MagasinSuivi,
  type SignauxArticle,
} from "@/server/content-gen/equipe/suivi-publication";
import { chargerCarteRequetes } from "@/server/content-gen/strategie/carte-requetes-source";

const QUEUE_NAME = "content-refresh";
const DEFAULT_OLDER_THAN_DAYS = 14;
const DEFAULT_MAX_PER_RUN = 10;

interface RefreshJobData {
  readonly trigger: "cron-weekly" | "manual";
  readonly olderThanDays?: number;
  readonly maxPerRun?: number;
  /**
   * Facultatif (le worker peut tourner une version différente de l'application) :
   * absent = scan de rafraîchissement, comme avant. Les autres tâches ne
   * s'exécutent que si CONTENT_EQUIPE_EDITORIALE=true.
   */
  readonly tache?: "suivi-publication" | "liens-hebdo";
}

export interface ContentRefreshResult {
  readonly scannedCount: number;
  readonly flaggedCount: number;
  readonly refreshedCount: number;
  readonly checkedAt: string;
  readonly suivi?: Readonly<Record<string, number>>;
}

const ENABLED_ENV = process.env.CONTENT_REFRESH_ENABLED === "true";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const JOUR_MS = 24 * 60 * 60 * 1000;

/** URL publique réelle d'un article (guides, actualités et blog n'ont pas la même route). */
function urlArticle(a: {
  isNews: boolean;
  templateVariant: string | null;
  translations: ReadonlyArray<{ slug: string }>;
}): string | null {
  const slug = a.translations[0]?.slug;
  if (!isRoutableArticleSlug(slug)) return null;
  return `${SITE_URL}/fr/${resolveArticleRoute({ isNews: a.isNews, templateVariant: a.templateVariant, slug: slug ?? null })}/${slug}`;
}

const TTL_S = 200 * 24 * 3600;

/** Mémoire des jalons faits, du quota du jour et des relevés : Redis, TTL borné. */
function magasinRedis(maintenant: Date): MagasinSuivi {
  const jour = maintenant.toISOString().slice(0, 10);
  return {
    dejaFait: async (c) => (await redis.exists(`suivi-pub:fait:${c}`)) === 1,
    marquer: async (c) => void (await redis.set(`suivi-pub:fait:${c}`, "1", "EX", TTL_S)),
    reserverQuota: async (n, max) => {
      const cle = `suivi-pub:quota:${jour}`;
      const total = await redis.incrby(cle, n);
      await redis.expire(cle, 2 * 24 * 3600);
      if (total <= max) return n;
      const accorde = Math.max(0, n - (total - max));
      await redis.decrby(cle, n - accorde);
      return accorde;
    },
    compterEchec: async (c) => {
      const cle = `suivi-pub:essais:${c}`;
      const n = await redis.incr(cle);
      await redis.expire(cle, TTL_S);
      return n;
    },
    lirePositions: async (id) => {
      const [a, b] = await redis.mget(`suivi-pub:pos:${id}:j28`, `suivi-pub:pos:${id}:j90`);
      return { j28: a === null ? null : Number(a), j90: b === null ? null : Number(b) };
    },
    ecrirePosition: async (id, jalon, position) => {
      await redis.set(`suivi-pub:pos:${id}:${jalon.slice(-3)}`, String(position), "EX", TTL_S);
    },
  };
}

async function articlesPublies(take: number) {
  return prisma.article.findMany({
    where: { status: "published", indexationTier: "tier_1_indexable", publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
    take,
    select: {
      id: true,
      publishedAt: true,
      updatedAt: true,
      isNews: true,
      templateVariant: true,
      translations: { where: { locale: "fr" }, select: { slug: true, body: true }, take: 1 },
    },
  });
}

async function runTacheEquipe(
  tache: "suivi-publication" | "liens-hebdo",
  checkedAt: string,
): Promise<ContentRefreshResult> {
  const maintenant = new Date(checkedAt);
  const magasin = magasinRedis(maintenant);
  const articles = await articlesPublies(500);
  const base = { scannedCount: articles.length, flaggedCount: 0, refreshedCount: 0, checkedAt };
  if (tache === "suivi-publication") {
    const r = await suivreArticles(
      articles.flatMap((a) => {
        const url = urlArticle(a);
        return url && a.publishedAt ? [{ id: a.id, url, publieLe: a.publishedAt }] : [];
      }),
      {
        magasin,
        maintenant,
        inspecter: (url) => gscInspectUrl(url),
        positions: async (url, jours) => {
          const m = await gscPageMetricsForUrl(url, jours);
          return m && m.impressions > 0
            ? { position: m.position, impressions: m.impressions }
            : null;
        },
      },
    );
    return { ...base, suivi: { ...r } };
  }
  // liens-hebdo : liens cassés (maillage vérifié) + alerte de cannibalisation.
  const casses = await controlerLiensArticles(
    articles.map((a) => ({ id: a.id, corps: a.translations[0]?.body ?? "" })),
    async (id, n) =>
      void (await redis.set(`suivi-pub:liens:${id}`, String(n), "EX", 14 * 24 * 3600)),
  );
  const carte = await chargerCarteRequetes().catch(() => null);
  if (carte && carte.cannibalisations.length > 0) {
    console.log(`[content-refresh] cannibalisation : ${carte.cannibalisations.length} requête(s)`);
  }
  return { ...base, flaggedCount: casses, suivi: { liensCasses: casses } };
}

async function runRefreshJob(job: Job<RefreshJobData>): Promise<ContentRefreshResult> {
  const checkedAt = new Date().toISOString();
  if (!ENABLED_ENV) {
    console.log("[content-refresh] disabled (CONTENT_REFRESH_ENABLED!=true) — skip");
    return { scannedCount: 0, flaggedCount: 0, refreshedCount: 0, checkedAt };
  }

  if (job.data.tache && equipeEditorialeActive()) {
    return runTacheEquipe(job.data.tache, checkedAt);
  }

  const olderThanDays =
    job.data.olderThanDays ?? envInt("CONTENT_REFRESH_OLDER_THAN_DAYS", DEFAULT_OLDER_THAN_DAYS);
  const maxPerRun =
    job.data.maxPerRun ?? envInt("CONTENT_REFRESH_MAX_PER_RUN", DEFAULT_MAX_PER_RUN);
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  // Scan : articles tier-1 publiés non rafraîchis depuis > olderThanDays, du
  // plus ancien au plus récent (les plus décayés d'abord). Best-effort.
  const equipe = equipeEditorialeActive();
  const stale = await prisma.article
    .findMany({
      where: {
        status: "published",
        indexationTier: "tier_1_indexable",
        // Interrupteur allumé : les règles de suivi remplacent le cutoff fixe.
        ...(equipe ? {} : { updatedAt: { lte: cutoff } }),
      },
      orderBy: { updatedAt: "asc" },
      take: equipe ? 500 : maxPerRun,
      select: {
        id: true,
        updatedAt: true,
        isNews: true,
        templateVariant: true,
        translations: { where: { locale: "fr" }, select: { slug: true }, take: 1 },
      },
    })
    .catch(() => []);

  const now = Date.now();
  let retenus = stale;
  if (equipe) {
    const magasin = magasinRedis(new Date(now));
    const cannib = (await chargerCarteRequetes().catch(() => null))?.cannibalisations ?? [];
    const signaux: SignauxArticle[] = await Promise.all(
      stale.map(async (a) => {
        const url = urlArticle(a);
        const pos = await magasin.lirePositions(a.id).catch(() => ({ j28: null, j90: null }));
        const liens = Number(await redis.get(`suivi-pub:liens:${a.id}`).catch(() => 0)) || 0;
        return {
          id: a.id,
          ageJours: Math.round((now - a.updatedAt.getTime()) / JOUR_MS),
          positionActuelle: pos.j90,
          positionReference: pos.j28,
          preuveExpireLe: null, // aucune source de péremption en base à ce jour
          liensCasses: liens,
          cannibalisation: url ? estCannibalise(url, cannib) : false,
        };
      }),
    );
    // Délai de grâce de 28 jours après un signalement : un relevé de position
    // n'est écrit qu'une fois, il ne doit pas re-signaler l'article à chaque passage.
    const choisis: string[] = [];
    for (const c of choisirCandidatsMiseAJour(signaux, new Date(now))) {
      if (choisis.length >= maxPerRun) break;
      const ok = await redis.set(`suivi-pub:alerte:${c.id}`, "1", "EX", 28 * 24 * 3600, "NX");
      if (ok === "OK") choisis.push(c.id);
    }
    const ids = new Set(choisis);
    retenus = stale.filter((a) => ids.has(a.id));
  }
  const candidates = retenus.map((a) => ({
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
