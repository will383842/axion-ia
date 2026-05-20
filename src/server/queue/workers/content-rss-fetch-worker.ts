/**
 * Content Generator — RSS fetch worker (§ 28 v1.7 pipeline 2 actualités).
 *
 * Sprint S+5 P2-3 (2026-05-20) — Migration storage :
 *   - V1.5 (actif)    : lit depuis table dédiée `RssSource` (Prisma model).
 *   - V1 (fallback)   : si la table `RssSource` est vide, fallback transitoire
 *                       sur `ContentGenConfig.key="rss_sources"` (JSON inline)
 *                       + warning log « DEPRECATED ». Sera retiré au prochain
 *                       sprint (1 release de grâce).
 *
 * Pour chaque item nouveau :
 *
 * 1. Vérifie dedup via hash(url + title) → ContentGenJob.idempotencyKey
 * 2. Enqueue job content-gen `contentType=blog_from_rss` avec inputPayload
 *    contenant l'item RSS (title + link + publishedAt + summary)
 * 3. Skip si auto-publish désactivé ET score insuffisant (post-gen)
 *
 * Stockage items pollés : ContentGenConfig.key="rss_items_seen" (array hash).
 * V1.5 migrera vers table RssItem propre quand volume > 1000 items.
 */

import { Queue, Worker, type Job } from "bullmq";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ssrfSafeFetch } from "@/lib/ssrf-safe-fetch";
import {
  readContentGenConfig,
  writeContentGenConfig,
} from "@/server/actions/content-gen/_settings";
import { parseFeed, type FeedItem } from "@/server/queue/lib/feed-parser";
import type { ContentGenJobPayload } from "./content-gen-worker";

const QUEUE_NAME = "content-rss-fetch";
const SEEN_KEY = "rss_items_seen";
const MAX_SEEN = 5000; // capping pour éviter explosion ContentGenConfig.value

/**
 * Forme runtime d'une source RSS — alignée sur les champs nécessaires au
 * worker (sous-ensemble du modèle Prisma `RssSource` + champs legacy
 * ContentGenConfig pour rétro-compat fallback).
 */
interface RssSource {
  readonly id?: string;
  readonly url: string;
  readonly name: string;
  readonly tags: ReadonlyArray<string>;
  readonly pollIntervalMin: number;
  readonly autoPublish: boolean;
  readonly enabled: boolean;
  readonly verticale?: string | null;
}

function hashItem(url: string, title: string): string {
  return crypto.createHash("sha256").update(`${url}::${title}`).digest("hex").slice(0, 16);
}

async function fetchSource(source: RssSource): Promise<ReadonlyArray<FeedItem>> {
  if (!source.enabled) return [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    // Méta-cert 2026-05-15 AGENT 12 P0 OWASP A10 — SSRF mitigation via
    // `ssrfSafeFetch` (DNS lookup + IP privée refusée + redirects validés).
    const res = await ssrfSafeFetch(source.url, {
      headers: { "User-Agent": "Axion-IA-content-gen/1.0 (+https://axion-ia.com)" },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[rss-fetch] ${source.url} HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    // Sprint S+4-E (P1-21) — parser universel RSS 2.0 / Atom 1.0 / RDF via
    // `fast-xml-parser`. Remplace l'ancien parser regex naïf qui ignorait
    // silencieusement les sources Atom (Substack, Ghost, Hugo, etc.).
    return parseFeed(xml);
  } catch (err) {
    console.warn(`[rss-fetch] ${source.url} error:`, err);
    return [];
  } finally {
    clearTimeout(timeout);
  }
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
 * Charge les sources RSS depuis la table dédiée `RssSource` (V1.5 storage).
 *
 * Fallback rétro-compat (1 release de grâce) : si la table est vide ET que
 * `ContentGenConfig.key="rss_sources"` contient des entrées, log un warning
 * `DEPRECATED` et utilise le JSON inline. Ce fallback sera retiré au sprint
 * S+6 (cf. P2-3 audit S+5 2026-05-20).
 *
 * Met aussi à jour `lastFetchedAt` après le tick (voir processJob) pour
 * tracer l'activité par source.
 */
async function loadRssSources(): Promise<ReadonlyArray<RssSource>> {
  // Stub-aware (ADR 0026) : si DATABASE_URL contient "stub.invalid" (build SSG
  // GH Actions sans DB), le Proxy Prisma retourne []. Aucun traitement runtime
  // ne devrait passer par cette branche, mais on garde le fallback gracieux.
  let dbRows: ReadonlyArray<{
    id: string;
    url: string;
    name: string;
    enabled: boolean;
    verticale: string | null;
    tags: unknown;
    pollIntervalMin: number;
    autoPublish: boolean;
  }> = [];
  try {
    dbRows = await prisma.rssSource.findMany({
      where: { enabled: true },
      select: {
        id: true,
        url: true,
        name: true,
        enabled: true,
        verticale: true,
        tags: true,
        pollIntervalMin: true,
        autoPublish: true,
      },
    });
  } catch (err) {
    // Table possiblement absente (migration pas encore appliquée) — on tombe
    // dans le fallback ContentGenConfig.
    console.warn(
      `[rss-fetch-worker] prisma.rssSource.findMany failed (table missing?): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  if (dbRows.length > 0) {
    return dbRows.map((r) => ({
      id: r.id,
      url: r.url,
      name: r.name,
      tags: Array.isArray(r.tags) ? (r.tags as ReadonlyArray<string>) : [],
      pollIntervalMin: r.pollIntervalMin,
      autoPublish: r.autoPublish,
      enabled: r.enabled,
      verticale: r.verticale,
    }));
  }

  // Fallback transitoire ContentGenConfig (DEPRECATED — retrait sprint S+6).
  const legacy = await readContentGenConfig<ReadonlyArray<RssSource>>("rss_sources", []);
  if (legacy.length > 0) {
    console.warn(
      `[rss-fetch-worker] DEPRECATED — lecture RSS depuis ContentGenConfig.key="rss_sources" (V1 JSON inline). ` +
        `Migrer les ${legacy.length} sources vers la table RssSource (run \`pnpm tsx prisma/seeds/rss-sources.ts\`). ` +
        `Ce fallback sera retiré sprint S+6.`,
    );
  }
  return legacy;
}

async function processJob(_job: Job<{ readonly trigger: string }>): Promise<void> {
  // Kill switch hard-gate (P1-7 fix audit opérationnel 2026-05-14).
  // Sans ce check, le RSS fetch continue à crawler les sources tiers et
  // accumuler des items "rss_items_seen" même quand Will a tout coupé.
  const killSwitch = await readContentGenConfig<{ active: boolean }>("kill_switch", {
    active: false,
  });
  if (killSwitch.active) {
    console.log("[rss-fetch-worker] kill switch active, skip tick");
    return;
  }
  const sources = await loadRssSources();
  const seenHashes = new Set(await readContentGenConfig<ReadonlyArray<string>>(SEEN_KEY, []));

  let totalEnqueued = 0;
  const newSeen: string[] = [];

  for (const source of sources) {
    const items = await fetchSource(source);
    // P2-3 — tracking santé par source : si le fetch a renvoyé au moins 1 item
    // ou si la source est joignable (parseFeed n'a pas throw), on marque
    // lastSuccessAt + reset failureCount. Sinon increment failureCount.
    // Best-effort : ne pas bloquer le tick si l'update échoue.
    if (source.id) {
      try {
        const now = new Date();
        if (items.length > 0) {
          await prisma.rssSource.update({
            where: { id: source.id },
            data: { lastFetchedAt: now, lastSuccessAt: now, failureCount: 0 },
          });
        } else {
          await prisma.rssSource.update({
            where: { id: source.id },
            data: { lastFetchedAt: now, failureCount: { increment: 1 } },
          });
        }
      } catch {
        // Pas de table (legacy fallback ContentGenConfig) ou row supprimée — no-op.
      }
    }
    for (const item of items) {
      const hash = hashItem(item.link, item.title);
      if (seenHashes.has(hash)) continue;
      seenHashes.add(hash);
      newSeen.push(hash);

      // 1. Crée une row ContentGenJob.queued AVANT enqueue BullMQ.
      // Le worker primaire `content-gen-worker` attend `contentGenJobId` dans le
      // payload (cf. ContentGenJobPayload). Sans cette row, le worker throw
      // UnrecoverableError au lookup DB. Idempotency : `idempotencyKey` unique
      // = hash(source + item) → P2002 silent skip si retry.
      // Sprint S+4-E — Le generator `blog_from_rss` reçoit toujours les mêmes
      // 4 champs canoniques (rssTitle/rssLink/rssPubDate/rssDescription) pour
      // rétro-compat ; les nouveaux champs Atom (author, tags, content riche,
      // updated) sont exposés en extra et exploitables par les versions
      // ultérieures du generator sans casser l'existant.
      const inputPayload = {
        rssTitle: item.title,
        rssLink: item.link,
        rssPubDate: item.published?.toISOString(),
        rssDescription: item.summary,
        rssSourceName: source.name,
        rssTags: source.tags,
        autoPublish: source.autoPublish,
        // Champs étendus (Atom + RSS riche) — optionnels, ignorés si generator
        // ancienne version. Permettent meilleur enrichissement éditorial.
        rssGuid: item.id,
        ...(item.content ? { rssContent: item.content } : {}),
        ...(item.author ? { rssAuthor: item.author } : {}),
        ...(item.updated ? { rssUpdated: item.updated.toISOString() } : {}),
        ...(item.tags && item.tags.length > 0 ? { rssItemTags: item.tags } : {}),
      };
      let contentGenJobId: string | null = null;
      try {
        const dbJob = await prisma.contentGenJob.create({
          data: {
            idempotencyKey: `rss-${hash}`,
            contentType: "blog_from_rss",
            status: "queued",
            priority: 5,
            inputPayload: inputPayload as never,
            targetLocale: "fr",
            // Pipeline 2 RSS = informational par défaut. Le generator
            // blog-from-rss peut ré-évaluer si nécessaire (mais reste safe).
            targetSearchIntent: "informational",
            primaryProvider: "openai",
            fallbackProvider: "anthropic",
          },
          select: { id: true },
        });
        contentGenJobId = dbJob.id;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Unique constraint") || msg.includes("P2002")) {
          // Race condition rare — un autre tick a inséré entre-temps. Skip.
          continue;
        }
        console.warn(`[rss-fetch-worker] DB insert ContentGenJob failed:`, msg);
        continue;
      }

      // 2. Enqueue content-gen avec payload conforme ContentGenJobPayload.
      const payload: ContentGenJobPayload = {
        contentGenJobId,
        contentType: "blog_from_rss",
        targetSearchIntent: "informational",
        inputPayload,
      };
      await getContentGenQueue().add(
        "blog_from_rss",
        payload,
        { jobId: `gen-${contentGenJobId}` }, // BullMQ dedup
      );
      totalEnqueued++;
    }
  }

  // Cap "seen" cache à MAX_SEEN entries (LRU FIFO trim)
  const allSeen = Array.from(seenHashes);
  const capped = allSeen.length > MAX_SEEN ? allSeen.slice(-MAX_SEEN) : allSeen;
  await writeContentGenConfig(SEEN_KEY, capped, "rss-fetch-worker", "RSS items seen cache");

  console.log(
    `[rss-fetch-worker] ${totalEnqueued} items new from ${sources.length} sources (${newSeen.length} hashes added)`,
  );
}

let workerInstance: Worker | null = null;

export function startRssFetchWorker(): Worker {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — rss-fetch-worker cannot start");
  workerInstance = new Worker(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 1, // serial pour éviter de spammer les sources tiers
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-rss-fetch-worker] job ${job?.id} failed:`, err);
  });
  return workerInstance;
}

export async function stopRssFetchWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
  if (contentGenQueue) {
    await contentGenQueue.close();
    contentGenQueue = null;
  }
}
