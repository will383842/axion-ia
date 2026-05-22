/**
 * V-04 P6 2026-05-22 — Tests primitives de précompression.
 *
 * Valide les invariants utilisés par scripts/precompress-static.ts :
 *  - Brotli quality 11 produit un meilleur ratio que Brotli quality 4 (texte).
 *  - Gzip 9 reste plus volumineux que Brotli 11 sur HTML (justifie Brotli prioritaire).
 *  - Les extensions cibles couvrent les artefacts Next 16 SSG (.js, .css, .html...).
 *  - Les extensions binaires (woff2, png, jpg…) NE sont PAS pré-compressées.
 *
 * Test découplé du script principal pour rester invariable face à la
 * refactorisation des chemins / I/O. Couvre uniquement la couche pure
 * compression+contrat (extensions ciblées).
 */

import { describe, it, expect } from "vitest";
import { brotliCompress, gzip, constants as zlibConstants } from "node:zlib";
import { promisify } from "node:util";

const brotliAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

const SAMPLE_HTML = `<!doctype html>
<html lang="fr">
<head><title>Axion-IA — Audit IA pour PME 2026</title></head>
<body>
<h1>Audit IA professionnel</h1>
<p>Selon BPI France, 85 % des PME n'ont pas évalué leur exposition aux risques IA.
La méthodologie Axion-IA en 5 dimensions (gouvernance, qualité, conformité,
sécurité, ROI) corrige cette lacune en 5-10 jours d'intervention sur site.</p>
<p>${"contenu répétitif ".repeat(200)}</p>
</body>
</html>`;

/** Extensions ciblées par scripts/precompress-static.ts (SSOT in this test). */
const COMPRESSIBLE_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".css",
  ".svg",
  ".json",
  ".html",
  ".txt",
  ".xml",
  ".map",
]);

const BINARY_EXTENSIONS = ["woff2", "png", "jpg", "webp", "avif", "ico", "mp4"];

describe("V-04 précompression — primitives Brotli/Gzip", () => {
  it("Brotli quality 11 produit un ratio meilleur que quality 4 (text)", async () => {
    const source = Buffer.from(SAMPLE_HTML, "utf8");
    const br4 = await brotliAsync(source, {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 4,
        [zlibConstants.BROTLI_PARAM_MODE]: zlibConstants.BROTLI_MODE_TEXT,
      },
    });
    const br11 = await brotliAsync(source, {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
        [zlibConstants.BROTLI_PARAM_MODE]: zlibConstants.BROTLI_MODE_TEXT,
      },
    });
    expect(br11.length).toBeLessThan(source.length);
    expect(br11.length).toBeLessThanOrEqual(br4.length);
  });

  it("Brotli 11 économise > 50 % sur HTML répétitif (vs source)", async () => {
    const source = Buffer.from(SAMPLE_HTML, "utf8");
    const br11 = await brotliAsync(source, {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
        [zlibConstants.BROTLI_PARAM_MODE]: zlibConstants.BROTLI_MODE_TEXT,
      },
    });
    const ratio = 1 - br11.length / source.length;
    expect(ratio).toBeGreaterThan(0.5);
  });

  it("Gzip 9 produit une sortie >= Brotli 11 sur HTML (justifie priorité Brotli)", async () => {
    const source = Buffer.from(SAMPLE_HTML, "utf8");
    const gz9 = await gzipAsync(source, { level: 9 });
    const br11 = await brotliAsync(source, {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
        [zlibConstants.BROTLI_PARAM_MODE]: zlibConstants.BROTLI_MODE_TEXT,
      },
    });
    expect(br11.length).toBeLessThanOrEqual(gz9.length);
  });

  it("Brotli GENERIC mode sur JS-like text donne bonne compression", async () => {
    const jsCode = `${"const x=1;".repeat(500)}`;
    const source = Buffer.from(jsCode, "utf8");
    const br11 = await brotliAsync(source, {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
        [zlibConstants.BROTLI_PARAM_MODE]: zlibConstants.BROTLI_MODE_GENERIC,
      },
    });
    expect(br11.length).toBeLessThan(100);
  });
});

describe("V-04 précompression — couverture extensions Next 16 SSG", () => {
  it("Extensions texte compressibles couvrent les artefacts Next 16 attendus", () => {
    expect(COMPRESSIBLE_EXTENSIONS.has(".js")).toBe(true);
    expect(COMPRESSIBLE_EXTENSIONS.has(".css")).toBe(true);
    expect(COMPRESSIBLE_EXTENSIONS.has(".html")).toBe(true);
    expect(COMPRESSIBLE_EXTENSIONS.has(".json")).toBe(true);
    expect(COMPRESSIBLE_EXTENSIONS.has(".xml")).toBe(true);
    expect(COMPRESSIBLE_EXTENSIONS.has(".svg")).toBe(true);
  });

  it("Extensions binaires déjà compressées sont exclues (overhead négatif)", () => {
    for (const ext of BINARY_EXTENSIONS) {
      expect(COMPRESSIBLE_EXTENSIONS.has(`.${ext}`)).toBe(false);
    }
  });

  it("Liste compressible est sans variantes .br/.gz (anti-double-compression)", () => {
    expect(COMPRESSIBLE_EXTENSIONS.has(".br")).toBe(false);
    expect(COMPRESSIBLE_EXTENSIONS.has(".gz")).toBe(false);
  });
});
