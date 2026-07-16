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
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { prisma } from "@/lib/prisma";
import { ssrfSafeFetch } from "@/lib/ssrf-safe-fetch";
import { readContentGenConfig } from "@/server/actions/content-gen/_settings";
import { persistContentGenConfig } from "@/server/content-gen/config-store";
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

// Filtre thématique IA (2026-07-03) — les flux GÉNÉRALISTES (`verticale=null` :
// Capital, Challenges…) injectent des news hors-sujet (politique, faits divers,
// feux de forêt) dans une page « Actualités IA ». On EXIGE qu'un item de ces flux
// matche un terme IA/tech AVANT de créer un job — sinon on le consomme (marqué
// "seen") sans générer, économisant tokens LLM + budget/jour. Les flux
// VERTICALISÉS (`verticale` non-null) sont curés → traités sans ce filtre.
const AI_TOPIC_PHRASES: ReadonlyArray<string> = [
  "intelligence artificielle",
  "artificial intelligence",
  "machine learning",
  "apprentissage automatique",
  "deep learning",
  "apprentissage profond",
  "réseau de neurones",
  "réseaux de neurones",
  "modèle de langage",
  "large language model",
  "ia générative",
  "generative ai",
  "chatgpt",
  "openai",
  "anthropic",
  "gemini",
  "mistral ai",
  "copilot",
  "nvidia",
  "prompt engineering",
  "algorithme",
  "automatisation",
  "agent ia",
  "agents ia",
  "agentique",
  "data science",
  "science des données",
  "vision par ordinateur",
  "computer vision",
  "hugging face",
  "perplexity",
  "midjourney",
  "cybersécurité",
  "cloud computing",
  "chatbot",
  "no-code",
  "saas",
];
// Tokens courts → frontière de mot uniquement (évite « via », « média », « biais »,
// et surtout PAS « ai » qui matcherait « j'ai »/« vrai » en français).
const AI_TOPIC_WORD_RE = /\b(ia|llm|llms|gpt|genai|agi)\b/i;

function isAiRelevant(...texts: ReadonlyArray<string | null | undefined>): boolean {
  const hay = texts
    .filter((t): t is string => Boolean(t))
    .join(" ")
    .toLowerCase();
  if (!hay) return false;
  if (AI_TOPIC_WORD_RE.test(hay)) return true;
  return AI_TOPIC_PHRASES.some((p) => hay.includes(p));
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

  // 2026-06-14 — Cap journalier de news RSS (policy `policies.rssMaxPerDay`,
  // défaut 20). Avant : le worker enquêtait TOUS les items nouveaux de TOUS les
  // flux à chaque tick horaire → volume non maîtrisé. Désormais on compte les
  // jobs `blog_from_rss` déjà créés aujourd'hui (UTC) et on n'enqueue plus une
  // fois le budget atteint. Les items au-delà du budget ne sont PAS marqués
  // "seen" → ils restent éligibles aux ticks suivants / au lendemain.
  const rssPolicies = await readContentGenConfig<{
    rssMaxPerDay?: number;
    rssMaxAgeDays?: number;
  }>("policies", {});
  const maxPerDay = rssPolicies.rssMaxPerDay ?? 5;
  const startOfDayUtc = new Date();
  startOfDayUtc.setUTCHours(0, 0, 0, 0);
  // 2026-07-04 — Fail-SAFE : l'ancien `.catch(() => 0)` faisait « fuiter » le cap.
  // Si le comptage échouait (hoquet DB), todayCount=0 restaurait un budget PLEIN
  // (maxPerDay news possibles) à CHAQUE tick en erreur → dépassement silencieux.
  // Désormais un échec de comptage skippe le tick (réessayé au tick suivant).
  const todayCount = await prisma.contentGenJob
    .count({ where: { contentType: "blog_from_rss", createdAt: { gte: startOfDayUtc } } })
    .catch(() => null);
  if (todayCount === null) {
    console.log("[rss-fetch-worker] comptage cap indisponible (DB) — skip tick par sécurité");
    return;
  }
  const dailyBudget = Math.max(0, maxPerDay - todayCount);
  if (dailyBudget <= 0) {
    console.log(
      `[rss-fetch-worker] cap journalier news atteint (${todayCount}/${maxPerDay}) — skip tick`,
    );
    return;
  }

  // Fenêtre de fraîcheur : on ABANDONNE toute news datée plus vieille que
  // `rssMaxAgeDays` (défaut 3 j) — une news traitée plusieurs jours après est
  // périmée. Les items trop vieux sont marqués "seen" (consommés, jamais générés).
  // Les items SANS date sont conservés (impossible de prouver qu'ils sont vieux)
  // mais passent en dernier dans la priorité de tri.
  const maxAgeDays = rssPolicies.rssMaxAgeDays ?? 3;
  const freshnessCutoffMs = Date.now() - maxAgeDays * 86_400_000;

  let totalEnqueued = 0;
  let offTopicSkipped = 0;
  const newSeen: string[] = [];

  // 1. Collecte de TOUS les items nouveaux (non vus) de TOUS les flux + santé source.
  const candidates: Array<{
    item: FeedItem;
    source: RssSource;
    hash: string;
    ts: number | null;
  }> = [];
  for (const source of sources) {
    const items = await fetchSource(source);
    // P2-3 — tracking santé par source (best-effort, ne bloque pas le tick).
    if (source.id) {
      try {
        const now = new Date();
        await prisma.rssSource.update({
          where: { id: source.id },
          data:
            items.length > 0
              ? { lastFetchedAt: now, lastSuccessAt: now, failureCount: 0 }
              : { lastFetchedAt: now, failureCount: { increment: 1 } },
        });
      } catch {
        // Pas de table (legacy fallback) ou row supprimée — no-op.
      }
    }
    for (const item of items) {
      const hash = hashItem(item.link, item.title);
      if (seenHashes.has(hash)) continue;
      // Garde-fou hors-sujet : sur les flux généralistes (verticale=null), on
      // n'accepte que les items IA/tech. Item non pertinent → consommé (seen) sans
      // génération, jamais reconsidéré.
      if (!source.verticale && !isAiRelevant(item.title, item.summary)) {
        seenHashes.add(hash);
        newSeen.push(hash);
        offTopicSkipped++;
        continue;
      }
      candidates.push({ item, source, hash, ts: item.published ? item.published.getTime() : null });
    }
  }

  // 2. Fraîcheur : drop des items datés trop vieux (consommés sans génération).
  const fresh: typeof candidates = [];
  let dropped = 0;
  for (const c of candidates) {
    if (c.ts !== null && c.ts < freshnessCutoffMs) {
      seenHashes.add(c.hash);
      newSeen.push(c.hash);
      dropped++;
    } else {
      fresh.push(c);
    }
  }

  // 3. Tri par fraîcheur DÉCROISSANTE (news la plus récente d'abord). Quand le
  // budget journalier < volume disponible, on choisit ainsi les MEILLEURES news
  // (les plus récentes), pas l'ordre arbitraire des flux. Items sans date → fin.
  fresh.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));

  // 4. Génération jusqu'au budget journalier. Les items frais NON retenus restent
  // non-"seen" → reconsidérés au prochain tick / lendemain TANT qu'ils sont frais
  // (au-delà de maxAgeDays ils seront abandonnés à l'étape 2 — pas de news périmée).
  for (const { item, source, hash } of fresh) {
    if (totalEnqueued >= dailyBudget) break;
    seenHashes.add(hash);
    newSeen.push(hash);

    // ContentGenJob.queued AVANT enqueue BullMQ (le content-gen-worker attend
    // contentGenJobId au lookup DB). Idempotency `rss-<hash>` → P2002 skip si retry.
    const inputPayload = {
      rssTitle: item.title,
      rssLink: item.link,
      rssPubDate: item.published?.toISOString(),
      rssDescription: item.summary,
      rssSourceName: source.name,
      rssTags: source.tags,
      autoPublish: source.autoPublish,
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
          targetSearchIntent: "informational",
          primaryProvider: "openai",
          fallbackProvider: "anthropic",
        },
        select: { id: true },
      });
      contentGenJobId = dbJob.id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Unique constraint") || msg.includes("P2002")) continue;
      console.warn(`[rss-fetch-worker] DB insert ContentGenJob failed:`, msg);
      continue;
    }

    const payload: ContentGenJobPayload = {
      contentGenJobId,
      contentType: "blog_from_rss",
      targetSearchIntent: "informational",
      inputPayload,
    };
    await getContentGenQueue().add("blog_from_rss", payload, { jobId: `gen-${contentGenJobId}` });
    totalEnqueued++;
  }

  if (offTopicSkipped > 0) {
    console.log(
      `[rss-fetch-worker] ${offTopicSkipped} item(s) hors-sujet IA écarté(s) des flux généralistes`,
    );
  }
  if (dropped > 0) {
    console.log(`[rss-fetch-worker] ${dropped} item(s) périmé(s) (> ${maxAgeDays}j) abandonné(s)`);
  }

  // Cap "seen" cache à MAX_SEEN entries (LRU FIFO trim)
  const allSeen = Array.from(seenHashes);
  const capped = allSeen.length > MAX_SEEN ? allSeen.slice(-MAX_SEEN) : allSeen;
  await persistContentGenConfig(SEEN_KEY, capped, "rss-fetch-worker", "RSS items seen cache");

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
    lockDuration: 120_000,
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-rss-fetch-worker] job ${job?.id} failed:`, err);
    captureWorkerError("rss-fetch", QUEUE_NAME, job, err);
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
