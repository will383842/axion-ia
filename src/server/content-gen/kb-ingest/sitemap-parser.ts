/**
 * Content Generator — Sitemap XML parser (Sprint 11.5 V2).
 *
 * Fetch un sitemap.xml externe et retourne la liste des URLs <loc>. Supporte :
 *   - Sitemap simple (<urlset><url><loc>...</loc>)
 *   - Sitemap index (<sitemapindex><sitemap><loc>...</loc>) → fetch récursif
 *
 * Limites :
 *   - 50 000 URLs max par sitemap (recommandation Google)
 *   - 50 MB max par fichier
 *   - Profondeur récursion sitemap-index : 2 niveaux (anti-loop)
 *
 * Pas de dépendance externe (XML parsing simple via regex — pas de cas
 * pathologiques type CDATA imbriqué dans nos sitemaps cibles).
 *
 * City Domination 2026-05-18 P0-12 — A13 audit : ajout du respect des
 * directives `robots.txt` Disallow/Crawl-Delay et `ai.txt` opt-out avant fetch.
 * Pas de migration `fetch()` → `ssrfSafeFetch` ici : l'URL est admin-fournie
 * (trusted) et sitemap.xml ne pose pas de risque SSRF (vs URL article qui peut
 * être user-submitted via futur endpoint public). Cf. `robots-respect.ts`.
 */

import { checkUrlAllowed } from "./robots-respect";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_URLS_PER_SITEMAP = 50_000;
const MAX_BYTES = 50_000_000;
const USER_AGENT = "Mozilla/5.0 (compatible; Axion-IA-KB-Ingest/1.0; +https://axion-ia.com/bot)";
const MAX_INDEX_DEPTH = 2;

export interface SitemapUrl {
  readonly loc: string;
  readonly lastmod: string | null;
  readonly priority: number | null;
}

async function fetchSitemap(url: string): Promise<string | null> {
  // P0-12 (2026-05-18) — Respect robots.txt / ai.txt avant fetch sitemap.
  // Certains sites bloquent /sitemap.xml pour les bots non-référencés.
  // fail-soft (cf. checkUrlAllowed retour `allowed: true` si robots.txt
  // absent ou erreur réseau).
  const robotsCheck = await checkUrlAllowed(url);
  if (!robotsCheck.allowed) return null;
  if (robotsCheck.crawlDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, robotsCheck.crawlDelayMs));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/xml,text/xml" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!resp.ok) return null;
    const text = await resp.text();
    if (text.length > MAX_BYTES) return null;
    return text;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractUrlsFromSitemap(xml: string): SitemapUrl[] {
  const urls: SitemapUrl[] = [];
  const urlBlockRe = /<url\b[^>]*>([\s\S]*?)<\/url>/gi;
  let match: RegExpExecArray | null;
  while ((match = urlBlockRe.exec(xml)) !== null) {
    if (urls.length >= MAX_URLS_PER_SITEMAP) break;
    const block = match[1]!;
    const locMatch = block.match(/<loc>\s*([\s\S]*?)\s*<\/loc>/i);
    if (!locMatch || !locMatch[1]) continue;
    const loc = decodeXmlEntities(locMatch[1].trim());

    const lastmodMatch = block.match(/<lastmod>\s*([\s\S]*?)\s*<\/lastmod>/i);
    const priorityMatch = block.match(/<priority>\s*([\s\S]*?)\s*<\/priority>/i);

    urls.push({
      loc,
      lastmod: lastmodMatch && lastmodMatch[1] ? lastmodMatch[1].trim() : null,
      priority: priorityMatch && priorityMatch[1] ? Number(priorityMatch[1].trim()) : null,
    });
  }
  return urls;
}

function extractIndexLocations(xml: string): string[] {
  const locations: string[] = [];
  const sitemapBlockRe = /<sitemap\b[^>]*>([\s\S]*?)<\/sitemap>/gi;
  let match: RegExpExecArray | null;
  while ((match = sitemapBlockRe.exec(xml)) !== null) {
    const block = match[1]!;
    const locMatch = block.match(/<loc>\s*([\s\S]*?)\s*<\/loc>/i);
    if (locMatch && locMatch[1]) locations.push(decodeXmlEntities(locMatch[1].trim()));
  }
  return locations;
}

/**
 * Parse un sitemap.xml externe. Si c'est un sitemap-index, fetch chaque
 * sitemap-child et concatène (max 2 niveaux de récursion).
 */
export async function parseSitemap(url: string, depth = 0): Promise<ReadonlyArray<SitemapUrl>> {
  if (depth > MAX_INDEX_DEPTH) return [];
  const xml = await fetchSitemap(url);
  if (!xml) return [];

  // Détecte si c'est un sitemap-index (priorité)
  if (/<sitemapindex/i.test(xml)) {
    const childUrls = extractIndexLocations(xml);
    const results = await Promise.all(childUrls.map((u) => parseSitemap(u, depth + 1)));
    return results.flat().slice(0, MAX_URLS_PER_SITEMAP);
  }

  return extractUrlsFromSitemap(xml);
}
