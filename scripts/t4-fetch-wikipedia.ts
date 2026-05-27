#!/usr/bin/env tsx
/**
 * Fetch Wikipedia FR pour chaque ville T4 et cache localement.
 * Utilise l'API REST publique fr.wikipedia.org (gratuite, sans clé).
 *
 * Cache structure : `_AUDIT/VILLES-T4-PROGRESS/wikipedia-cache/<slug>.json`
 *
 * Champs cachés :
 * - title (Wikipedia title resolved)
 * - extract (résumé 4-6 phrases du début de l'article)
 * - description (description courte ~80 chars)
 * - coordinates (lat/lon Wikipedia)
 * - thumbnail (URL image)
 * - sectionsAvailable (liste des sections potentielles : Patrimoine, Économie, etc.)
 *
 * Usage :
 *   pnpm tsx scripts/t4-fetch-wikipedia.ts          # Fetch toutes les pending sans cache
 *   pnpm tsx scripts/t4-fetch-wikipedia.ts 50       # Limiter à 50 villes par run
 *   pnpm tsx scripts/t4-fetch-wikipedia.ts --slugs=a,b,c  # Cibler villes spécifiques
 *
 * Throttling : 200ms entre chaque requête (respect Wikipedia rate limit).
 * Resume support : skip si fichier cache existe déjà.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PROGRESS_PATH = resolve(process.cwd(), "_AUDIT/VILLES-T4-PROGRESS/progress.json");
const CACHE_DIR = resolve(process.cwd(), "_AUDIT/VILLES-T4-PROGRESS/wikipedia-cache");

interface VilleStatus {
  slug: string;
  nameFr: string;
  region: string;
  departement: string;
  population: number;
}

interface Progress {
  villes: Record<string, VilleStatus>;
}

interface WikipediaCache {
  fetchedAt: string;
  villeSlug: string;
  villeName: string;
  wikipediaTitle: string | null;
  extract: string | null; // résumé 4-6 phrases
  description: string | null; // 1 phrase
  coordinates: { lat: number; lon: number } | null;
  thumbnailUrl: string | null;
  notFound: boolean;
}

/**
 * Fetch summary (description courte) + full intro extract via action=query.
 * L'endpoint REST summary est trop court (1 phrase). L'action API donne l'intro
 * complète (2000-5000 chars) en plain text incluant patrimoine, économie, etc.
 */
async function fetchVilleWikipedia(ville: VilleStatus): Promise<WikipediaCache> {
  const titles = [
    ville.nameFr,
    `${ville.nameFr} (${ville.departement})`,
    `${ville.nameFr.replace(/'/g, "’")}`, // typographic apostrophe
  ];

  for (const title of titles) {
    try {
      // 1) Endpoint REST summary pour description courte + coords + thumbnail
      const summaryUrl = `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`;
      const summaryRes = await fetch(summaryUrl, {
        headers: { "User-Agent": "AxionIA-VillesT4-Cache/1.0 (contact@axion-ia.com)" },
      });
      if (summaryRes.status === 404) continue;
      if (!summaryRes.ok) {
        console.warn(`[t4-wiki] ${ville.slug}: HTTP ${summaryRes.status} on "${title}"`);
        continue;
      }
      const summary = (await summaryRes.json()) as {
        title?: string;
        extract?: string;
        description?: string;
        coordinates?: { lat: number; lon: number };
        thumbnail?: { source?: string };
        type?: string;
      };
      if (summary.type === "disambiguation") continue;
      const resolvedTitle = summary.title ?? title;

      // 2) action=query pour intro complète (plain text, intro section seulement)
      const extractUrl = `https://fr.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&format=json&titles=${encodeURIComponent(resolvedTitle.replace(/ /g, "_"))}&origin=*`;
      const extractRes = await fetch(extractUrl, {
        headers: { "User-Agent": "AxionIA-VillesT4-Cache/1.0 (contact@axion-ia.com)" },
      });
      let fullIntro: string | null = null;
      if (extractRes.ok) {
        const extractData = (await extractRes.json()) as {
          query?: { pages?: Record<string, { extract?: string }> };
        };
        const pages = extractData.query?.pages;
        if (pages) {
          const firstPage = Object.values(pages)[0];
          if (firstPage?.extract) {
            // Truncate to ~3000 chars to limit cache size
            fullIntro = firstPage.extract.slice(0, 3000);
          }
        }
      }

      return {
        fetchedAt: new Date().toISOString(),
        villeSlug: ville.slug,
        villeName: ville.nameFr,
        wikipediaTitle: resolvedTitle,
        extract: fullIntro ?? summary.extract ?? null,
        description: summary.description ?? null,
        coordinates: summary.coordinates ?? null,
        thumbnailUrl: summary.thumbnail?.source ?? null,
        notFound: false,
      };
    } catch (err) {
      console.warn(`[t4-wiki] ${ville.slug}: fetch error on "${title}" : ${err}`);
    }
  }

  return {
    fetchedAt: new Date().toISOString(),
    villeSlug: ville.slug,
    villeName: ville.nameFr,
    wikipediaTitle: null,
    extract: null,
    description: null,
    coordinates: null,
    thumbnailUrl: null,
    notFound: true,
  };
}

function parseArgs(): { limit: number; slugs: string[] | null; force: boolean } {
  const argv = process.argv.slice(2);
  let limit = Infinity;
  let slugs: string[] | null = null;
  let force = false;

  for (const arg of argv) {
    if (arg === "--force") {
      force = true;
    } else if (arg.startsWith("--slugs=")) {
      slugs = arg
        .replace("--slugs=", "")
        .split(",")
        .map((s) => s.trim());
    } else if (/^\d+$/.test(arg)) {
      limit = parseInt(arg, 10);
    }
  }

  return { limit, slugs, force };
}

async function main() {
  const args = parseArgs();
  const progress = JSON.parse(readFileSync(PROGRESS_PATH, "utf-8")) as Progress;
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

  // Filter villes
  let villes = Object.values(progress.villes);
  if (args.slugs) {
    const set = new Set(args.slugs);
    villes = villes.filter((v) => set.has(v.slug));
  }
  // Sort by population descending = prioritise les plus grandes
  villes.sort((a, b) => b.population - a.population);

  // Skip already cached (unless --force)
  if (!args.force) {
    villes = villes.filter((v) => {
      const cachePath = resolve(CACHE_DIR, `${v.slug}.json`);
      return !existsSync(cachePath);
    });
  }

  villes = villes.slice(0, args.limit);

  console.log(`[t4-wiki] Fetching Wikipedia for ${villes.length} villes (throttle 200ms each)`);

  let success = 0;
  let notFound = 0;
  for (let i = 0; i < villes.length; i++) {
    const v = villes[i]!;
    process.stdout.write(`[${i + 1}/${villes.length}] ${v.slug}... `);
    const cache = await fetchVilleWikipedia(v);
    const cachePath = resolve(CACHE_DIR, `${v.slug}.json`);
    writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf-8");
    if (cache.notFound) {
      notFound++;
      process.stdout.write(`❌ not found\n`);
    } else {
      success++;
      process.stdout.write(`✅ ${cache.wikipediaTitle ?? ""}\n`);
    }
    // Throttle 200ms
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(
    `\n[t4-wiki] Done: ${success} cached, ${notFound} not found, ${villes.length} total.`,
  );
}

main().catch((err) => {
  console.error("[t4-wiki] error:", err);
  process.exit(1);
});
