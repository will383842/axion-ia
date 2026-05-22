#!/usr/bin/env npx tsx
/**
 * V-04 P6 2026-05-22 — Pre-compression statique build-time (Brotli 11 + Gzip 9).
 *
 * Compresse les assets statiques `.next/static/**` et `.next/standalone/.next/static/**`
 * en variantes `.br` (Brotli qualité 11, ratio maximum) et `.gz` (Gzip 9). Caddy 2
 * peut servir ces fichiers pré-compressés via la directive `file_server { precompressed br gzip }`
 * (cf. Caddyfile sous-section précompressée — Sprint 26 V-04).
 *
 * Pourquoi build-time vs runtime ?
 *  - Brotli 11 coûte ~10× CPU vs Brotli 9 en runtime (raison pour laquelle
 *    Caddyfile encode br 9). Build-time, on l'amortit une fois et on gagne
 *    ~5-10 % de bande passante sur HTML / JS / CSS vs Brotli 9.
 *  - Les chunks Next 16 (hashes immutables) ne changent qu'au build → l'effort
 *    de compression est durable jusqu'au prochain `pnpm build`.
 *  - Aucun coût runtime côté Caddy ni Next standalone server.
 *
 * Extensions ciblées :
 *  - `.js`, `.css`, `.svg` : meilleur ratio Brotli sur texte (×3-7).
 *  - `.json` : sitemap chunks, manifests, RSC payloads partiels.
 *  - `.html` : pages SSG pré-rendues (~80-150 KB chacune, gain LCP -50 à -120 ms p75).
 *  - `.txt`, `.xml` : robots.txt, sitemap-index.xml, sitemap-*.xml.
 *
 * Skipping :
 *  - Fichiers < 1 KB (overhead header > économie ; minimum_length de Caddy = 4096
 *    mais on précompress dès 1 KB pour les petits sitemap chunks).
 *  - Fichiers binaires déjà compressés (woff2, png, jpg, webp, avif).
 *
 * Idempotent : si le `.br` existe déjà avec mtime > source, skip.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { brotliCompress, gzip, constants as zlibConstants } from "node:zlib";
import { promisify } from "node:util";

const brotliAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

const ROOT = path.resolve(process.cwd(), ".next");
const TARGET_DIRS = [
  path.join(ROOT, "static"),
  path.join(ROOT, "standalone", ".next", "static"),
  path.join(ROOT, "server", "app"),
];

const COMPRESSIBLE_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".css",
  ".svg",
  ".json",
  ".html",
  ".txt",
  ".xml",
  ".map", // sourcemaps texte
]);

const MIN_SIZE_BYTES = 1024; // 1 KB — overhead headers compense

interface Stats {
  scanned: number;
  compressed: number;
  skippedSmall: number;
  skippedNotText: number;
  skippedUpToDate: number;
  totalSourceBytes: number;
  totalBrBytes: number;
  totalGzBytes: number;
}

async function walk(dir: string, files: string[]): Promise<void> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return; // dir absent (build partiel) → no-op silent
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, files);
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
}

async function shouldRecompress(src: string, target: string): Promise<boolean> {
  try {
    const [srcStat, targetStat] = await Promise.all([fs.stat(src), fs.stat(target)]);
    return srcStat.mtimeMs > targetStat.mtimeMs;
  } catch {
    return true; // target absent → must compress
  }
}

async function compressOne(file: string, stats: Stats): Promise<void> {
  stats.scanned++;
  const ext = path.extname(file).toLowerCase();
  if (!COMPRESSIBLE_EXTENSIONS.has(ext) || file.endsWith(".br") || file.endsWith(".gz")) {
    stats.skippedNotText++;
    return;
  }

  const srcStat = await fs.stat(file);
  if (srcStat.size < MIN_SIZE_BYTES) {
    stats.skippedSmall++;
    return;
  }

  const brTarget = `${file}.br`;
  const gzTarget = `${file}.gz`;

  const needsBr = await shouldRecompress(file, brTarget);
  const needsGz = await shouldRecompress(file, gzTarget);
  if (!needsBr && !needsGz) {
    stats.skippedUpToDate++;
    return;
  }

  const buffer = await fs.readFile(file);
  stats.totalSourceBytes += buffer.length;

  const tasks: Promise<void>[] = [];
  if (needsBr) {
    tasks.push(
      brotliAsync(buffer, {
        params: {
          [zlibConstants.BROTLI_PARAM_QUALITY]: 11, // qualité max
          [zlibConstants.BROTLI_PARAM_MODE]:
            ext === ".html" || ext === ".css" || ext === ".svg" || ext === ".xml"
              ? zlibConstants.BROTLI_MODE_TEXT
              : zlibConstants.BROTLI_MODE_GENERIC,
        },
      }).then(async (out) => {
        await fs.writeFile(brTarget, out);
        stats.totalBrBytes += out.length;
      }),
    );
  }
  if (needsGz) {
    tasks.push(
      gzipAsync(buffer, { level: 9 }).then(async (out) => {
        await fs.writeFile(gzTarget, out);
        stats.totalGzBytes += out.length;
      }),
    );
  }

  await Promise.all(tasks);
  stats.compressed++;
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const files: string[] = [];
  for (const dir of TARGET_DIRS) {
    await walk(dir, files);
  }

  if (files.length === 0) {
    console.warn(
      `[precompress-static] Aucun fichier trouvé sous ${TARGET_DIRS.join(", ")}. Skip (build partiel ?).`,
    );
    return;
  }

  const stats: Stats = {
    scanned: 0,
    compressed: 0,
    skippedSmall: 0,
    skippedNotText: 0,
    skippedUpToDate: 0,
    totalSourceBytes: 0,
    totalBrBytes: 0,
    totalGzBytes: 0,
  };

  // Parallélisme limité (8 workers max) pour ne pas saturer CPU build-time.
  const CONCURRENCY = 8;
  const queue = [...files];
  const workers: Promise<void>[] = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(
      (async () => {
        while (queue.length > 0) {
          const next = queue.shift();
          if (next === undefined) break;
          try {
            await compressOne(next, stats);
          } catch (err) {
            console.warn(
              `[precompress-static] échec ${next}:`,
              err instanceof Error ? err.message : err,
            );
          }
        }
      })(),
    );
  }
  await Promise.all(workers);

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  const brRatio =
    stats.totalSourceBytes > 0
      ? ((1 - stats.totalBrBytes / stats.totalSourceBytes) * 100).toFixed(1)
      : "0.0";
  const gzRatio =
    stats.totalSourceBytes > 0
      ? ((1 - stats.totalGzBytes / stats.totalSourceBytes) * 100).toFixed(1)
      : "0.0";

  console.log(
    [
      `[precompress-static] ${elapsed}s | scanned=${stats.scanned} compressed=${stats.compressed} skipped=${stats.skippedSmall + stats.skippedNotText + stats.skippedUpToDate} (small=${stats.skippedSmall}, binaire=${stats.skippedNotText}, à jour=${stats.skippedUpToDate})`,
      `[precompress-static] source=${(stats.totalSourceBytes / 1024).toFixed(1)} KB | brotli11=${(stats.totalBrBytes / 1024).toFixed(1)} KB (-${brRatio}%) | gzip9=${(stats.totalGzBytes / 1024).toFixed(1)} KB (-${gzRatio}%)`,
    ].join("\n"),
  );
}

main().catch((err) => {
  console.error("[precompress-static] Erreur fatale:", err);
  process.exit(1);
});
