/**
 * Content Generator — RSS fetch worker (§ 28 v1.7 pipeline 2 actualités).
 *
 * V1 = skeleton functional. Polls les sources RSS configurées en
 * ContentGenConfig.key="rss_sources" (V1 storage transitoire — V1.5 = tables
 * dédiées RssSource + RssItem). Pour chaque item nouveau :
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
import {
  readContentGenConfig,
  writeContentGenConfig,
} from "@/server/actions/content-gen/_settings";

const QUEUE_NAME = "content-rss-fetch";
const SEEN_KEY = "rss_items_seen";
const MAX_SEEN = 5000; // capping pour éviter explosion ContentGenConfig.value

interface RssSource {
  readonly url: string;
  readonly name: string;
  readonly tags: ReadonlyArray<string>;
  readonly pollIntervalMin: number;
  readonly autoPublish: boolean;
  readonly enabled: boolean;
}

interface ParsedRssItem {
  readonly title: string;
  readonly link: string;
  readonly pubDate?: string;
  readonly description?: string;
}

function hashItem(url: string, title: string): string {
  return crypto.createHash("sha256").update(`${url}::${title}`).digest("hex").slice(0, 16);
}

/**
 * Parse RSS XML minimal V1 (regex naïf — V1.5 ajoutera `fast-xml-parser`).
 * Volontairement minimal pour éviter dépendance npm supplémentaire en V1.
 */
function parseRssXml(xml: string): ReadonlyArray<ParsedRssItem> {
  const items: ParsedRssItem[] = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  const titleRegex = /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i;
  const linkRegex = /<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i;
  const dateRegex = /<pubDate[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/i;
  const descRegex = /<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i;

  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null) {
    const body = match[1] ?? "";
    const t = titleRegex.exec(body);
    const l = linkRegex.exec(body);
    const d = dateRegex.exec(body);
    const desc = descRegex.exec(body);
    if (!t?.[1] || !l?.[1]) continue;
    items.push({
      title: t[1].trim(),
      link: l[1].trim(),
      ...(d?.[1] ? { pubDate: d[1].trim() } : {}),
      ...(desc?.[1] ? { description: desc[1].trim() } : {}),
    });
  }
  return items;
}

async function fetchSource(source: RssSource): Promise<ReadonlyArray<ParsedRssItem>> {
  if (!source.enabled) return [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(source.url, {
      headers: { "User-Agent": "AxionIA-content-gen/1.0 (+https://axion-ia.com)" },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[rss-fetch] ${source.url} HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    return parseRssXml(xml);
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

async function processJob(_job: Job<{ readonly trigger: string }>): Promise<void> {
  const sources = await readContentGenConfig<ReadonlyArray<RssSource>>("rss_sources", []);
  const seenHashes = new Set(await readContentGenConfig<ReadonlyArray<string>>(SEEN_KEY, []));

  let totalEnqueued = 0;
  const newSeen: string[] = [];

  for (const source of sources) {
    const items = await fetchSource(source);
    for (const item of items) {
      const hash = hashItem(item.link, item.title);
      if (seenHashes.has(hash)) continue;
      seenHashes.add(hash);
      newSeen.push(hash);

      // Enqueue content-gen job (le worker primaire pickera + générera)
      await getContentGenQueue().add(
        "blog_from_rss",
        {
          contentType: "blog_from_rss",
          inputPayload: {
            rssTitle: item.title,
            rssLink: item.link,
            rssPubDate: item.pubDate,
            rssDescription: item.description,
            rssSourceName: source.name,
            rssTags: source.tags,
            autoPublish: source.autoPublish,
          },
        },
        { jobId: `rss-${hash}` }, // dedup BullMQ level
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
