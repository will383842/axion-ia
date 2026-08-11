// Daily IndexNow re-submit — audit indexation 2026-05-18 P1-12.
//
// Cron daily 02:00 UTC qui re-ping IndexNow toutes les URLs publiées dans les
// 7 derniers jours. Insurance contre cas où IndexNow réception aléatoire Bing
// (mémoire `axionia_pr14_image_bank_v1_2026-05-16.md` mentionne historique
// non-réception ponctuelle). Coût zéro (IndexNow free), idempotent côté Bing
// (re-ping même URL = no-op si déjà connu).

// Marker ES module — évite global namespace conflicts avec autres scripts
// du dossier `scripts/` (indexnow-ping.ts partage `INDEXNOW_ENDPOINT`).
export {};
//
// Méthode : auto-discovery via sitemap-index.xml live + sub-sitemaps + filter
// lastmod ≥ J-7. Pas de DB access requis (utilise les XML sitemaps que Will
// expose déjà publiquement). Compatible cron GH Actions runner.
//
// Comportement :
//   - Si `INDEXNOW_KEY` non défini → no-op exit 0 (dev sans secret)
//   - Sinon → fetch sitemap-index + sub-sitemaps + filter récents + POST batch
//   - Errors non-fatales (log warn + exit 0)
//
// Limite : ne couvre que les URLs IN sitemap. Pour KB ressources hors sitemap
// (V1 = 0 KB entries) ou orphans, voir P1-18 BFS link graph audit.

import { submitToIndexNow } from "../src/lib/indexnow";
const DEFAULT_SITE_URL = "https://axion-ia.com";

// Fenêtre 7 jours glissante. Cohérent avec cadence factory ~20-100 articles/jour.
const FRESHNESS_WINDOW_DAYS = 7;
const FRESHNESS_WINDOW_MS = FRESHNESS_WINDOW_DAYS * 24 * 60 * 60 * 1000;

// IndexNow accepte jusqu'à 10 000 URLs/batch. On reste à 1 000 pour rester
// safe sous le quota et limiter la charge origin (chaque ping = 1 fetch URL
// côté Bing post-réception pour vérification).
const MAX_URLS_PER_BATCH = 1000;

interface SitemapUrl {
  loc: string;
  lastmod?: string;
}

/**
 * Parse XML sitemap (urlset or sitemapindex) extract `<loc>` + `<lastmod>`.
 * Naive regex parser — XML sitemaps sont structurellement simples + générés
 * par notre code (pas de cas adversaires). Évite une dep XML.
 */
function parseSitemap(xml: string): SitemapUrl[] {
  const urls: SitemapUrl[] = [];
  const urlBlocks = xml.matchAll(/<url>([\s\S]*?)<\/url>/g);
  for (const m of urlBlocks) {
    const block = m[1] ?? "";
    const locMatch = block.match(/<loc>([^<]+)<\/loc>/);
    if (!locMatch) continue;
    const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/);
    urls.push({
      loc: locMatch[1]!.trim(),
      ...(lastmodMatch ? { lastmod: lastmodMatch[1]!.trim() } : {}),
    });
  }
  return urls;
}

/** Parse sitemap-index `<sitemap><loc>` to list sub-sitemap URLs. */
function parseSitemapIndex(xml: string): string[] {
  const locs: string[] = [];
  const sitemapBlocks = xml.matchAll(/<sitemap>([\s\S]*?)<\/sitemap>/g);
  for (const m of sitemapBlocks) {
    const block = m[1] ?? "";
    const locMatch = block.match(/<loc>([^<]+)<\/loc>/);
    if (locMatch) locs.push(locMatch[1]!.trim());
  }
  return locs;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "axion-ia-indexnow-resubmit-bot/1.0" },
    });
    if (!res.ok) {
      console.warn(`[daily-indexnow-resubmit] fetch ${url} → ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(
      `[daily-indexnow-resubmit] fetch ${url} error :`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

async function collectRecentUrls(siteUrl: string): Promise<string[]> {
  const cutoff = Date.now() - FRESHNESS_WINDOW_MS;
  const indexXml = await fetchText(`${siteUrl}/sitemap-index.xml`);
  if (!indexXml) {
    console.warn("[daily-indexnow-resubmit] sitemap-index unreachable, abort");
    return [];
  }
  const subSitemaps = parseSitemapIndex(indexXml);
  if (subSitemaps.length === 0) {
    console.warn("[daily-indexnow-resubmit] no sub-sitemaps in index, abort");
    return [];
  }

  const recentUrls = new Set<string>();
  for (const sub of subSitemaps) {
    const subXml = await fetchText(sub);
    if (!subXml) continue;
    const urls = parseSitemap(subXml);
    for (const u of urls) {
      if (!u.lastmod) continue;
      const lastmodMs = new Date(u.lastmod).getTime();
      if (Number.isNaN(lastmodMs)) continue;
      if (lastmodMs >= cutoff) {
        recentUrls.add(u.loc);
      }
    }
  }
  return Array.from(recentUrls);
}

async function pingBatch(urls: string[], host: string, key: string): Promise<void> {
  if (urls.length === 0) return;
  // Cascade d'endpoints (SSOT `src/lib/indexnow.ts`) : `api.indexnow.org` refuse
  // ce domaine (403 `UserForbiddedToAccessSite`, back-end Microsoft). Sans la
  // bascule, ce cron re-soumettait dans le vide tous les jours, en silence.
  const result = await submitToIndexNow(host, key, urls);
  if (result.accepted) {
    console.log(
      `[daily-indexnow-resubmit] OK — ${urls.length} URLs acceptées par ${result.accepted}.`,
    );
  } else {
    console.warn(
      process.env["GITHUB_ACTIONS"] === "true"
        ? `::warning title=IndexNow::resoumission quotidienne refusée par tous les endpoints (${urls.length} URLs) — ${result.attempts.join(" | ")}`
        : `[daily-indexnow-resubmit] refusé par tous les endpoints — ${result.attempts.join(" | ")}`,
    );
  }
}

async function main(): Promise<void> {
  const key = process.env["INDEXNOW_KEY"];
  const siteUrl = (process.env["NEXT_PUBLIC_SITE_URL"] ?? DEFAULT_SITE_URL).replace(/\/$/, "");

  if (!key) {
    console.log("[daily-indexnow-resubmit] skipped — INDEXNOW_KEY not set.");
    return;
  }
  if (siteUrl.includes("localhost") || siteUrl.includes("127.0.0.1")) {
    console.log("[daily-indexnow-resubmit] skipped — SITE_URL points to localhost.");
    return;
  }

  const host = new URL(siteUrl).host;

  const recentUrls = await collectRecentUrls(siteUrl);
  if (recentUrls.length === 0) {
    console.log("[daily-indexnow-resubmit] no recent URLs (window 7d) — nothing to re-ping.");
    return;
  }

  console.log(
    `[daily-indexnow-resubmit] discovered ${recentUrls.length} URLs with lastmod ≥ J-${FRESHNESS_WINDOW_DAYS}`,
  );

  // Batch par 1000 (sub-cap pratique IndexNow 10K/batch).
  for (let i = 0; i < recentUrls.length; i += MAX_URLS_PER_BATCH) {
    const batch = recentUrls.slice(i, i + MAX_URLS_PER_BATCH);
    await pingBatch(batch, host, key);
  }
}

void main();
