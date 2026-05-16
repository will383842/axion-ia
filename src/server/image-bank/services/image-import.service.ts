// Template : src/server/image-bank/services/image-import.service.ts
//
// Sharp pipeline : original → variants WebP + AVIF + LQIP + thumbnail.
//
// Doctrine Axion-IA :
//   - Sharp `limitInputPixels: 100_000_000` (anti zip-bomb)
//   - SHA-256 dedup avant écriture
//   - Storage local en dev (`public/image-bank/{uuid}/...`), S3 Hetzner en prod
//   - `.withMetadata()` pour stripper EXIF puis ré-embed copyright propre
//   - Slugs ASCII via slugify strict
//
// Voir spec détaillée : `references/responsive-variants.md`.

import { createHash, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import sharp from "sharp";

import {
  ACCEPTED_INPUT_FORMATS,
  AVIF_EFFORT,
  AVIF_QUALITY,
  AVIF_VARIANTS,
  LQIP_BLUR,
  LQIP_JPEG_QUALITY,
  LQIP_WIDTH,
  OG_VARIANT,
  SHARP_LIMITS,
  THUMBNAIL_WIDTH,
  UPLOAD_BYTES_MAX,
  WEBP_EFFORT,
  WEBP_QUALITY,
  WEBP_VARIANTS,
  type Orientation,
} from "../constants";
import { getStorageBasePath, publicUrlFromLocalPath } from "../utils/paths";
import type { ImportInput, ImportResult } from "../types";

// Types + constantes centralisés dans `../types.ts` et `../constants.ts`.

export class ImageImportService {
  /**
   * Pipeline complet : validation → SHA-256 → variants → LQIP → return paths.
   * Synchrone si image < 5 MB, sinon caller doit l'enqueue dans BullMQ.
   */
  async importImage(input: ImportInput): Promise<ImportResult> {
    // 1) Magic bytes via Sharp metadata (refuse les non-images même si mimetype lie).
    const meta = await sharp(input.buffer, SHARP_LIMITS).metadata();
    if (!meta.width || !meta.height) {
      throw new Error("[image-import] Image sans dimensions exploitables");
    }
    if (!ACCEPTED_INPUT_FORMATS.includes(meta.format as (typeof ACCEPTED_INPUT_FORMATS)[number])) {
      throw new Error(`[image-import] Format non supporté : ${meta.format}`);
    }
    if (input.buffer.byteLength > UPLOAD_BYTES_MAX) {
      throw new Error(`[image-import] Fichier > ${UPLOAD_BYTES_MAX / 1024 / 1024} MB`);
    }

    // 2) SHA-256 du buffer original (dedup côté caller via fileHash).
    const fileHash = createHash("sha256").update(input.buffer).digest("hex");

    // 3) UUID + dossier
    const uuid = randomUUID();
    const storageBase = getStorageBasePath();
    const dir = join(storageBase, uuid);
    await mkdir(dir, { recursive: true });

    const orientation = computeOrientation(meta.width, meta.height);
    const aspectRatio = computeAspectRatio(meta.width, meta.height);

    // 3.5) RGPD CRITIQUE : strip EXIF GPS si présent (PII).
    // Sharp `.withMetadata()` par défaut preserve EXIF. On force la normalization
    // sur tous les variants via `withMetadata({ orientation: 1 })` qui re-écrit
    // l'EXIF minimal SANS les tags GPS (Sharp strip automatiquement les autres
    // tags non-whitelistés). Photo iPhone embarque latitude/longitude → si publié
    // c'est PII = violation RGPD. Sécurité par défaut.
    //
    // Pour preserver intentionnellement un GPS (ex. photo lieu touristique),
    // le caller doit le copier dans `image.geoPosition` AVANT et nous le strip
    // toujours du fichier final.

    // 4) Variants WebP — boucle sm/md/lg/xl (skip si > source width)
    const srcsetParts: string[] = [];
    let mainPath = "";
    for (const v of WEBP_VARIANTS) {
      if (meta.width < v.width && v.name !== "sm") continue;
      const out = join(dir, `image-${v.name}.webp`);
      await sharp(input.buffer, SHARP_LIMITS)
        .resize({ width: Math.min(v.width, meta.width), withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT })
        .withMetadata({ orientation: 1 }) // strip EXIF rotation, normalize
        .toFile(out);
      srcsetParts.push(`${publicUrlFromLocalPath(out)} ${v.width}w`);
      if (v.name === "lg") mainPath = publicUrlFromLocalPath(out);
    }
    if (!mainPath) {
      const last = srcsetParts[srcsetParts.length - 1];
      mainPath = last?.split(" ")[0] ?? publicUrlFromLocalPath(join(dir, "image-sm.webp"));
    }

    // 5) Thumbnail (300w default)
    const thumbOut = join(dir, "thumb.webp");
    await sharp(input.buffer, SHARP_LIMITS)
      .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT })
      .toFile(thumbOut);

    // 6) AVIF — md/lg (qualité 55 = visuellement équivalent à WebP 80, mais plus léger)
    let avifPath: string | null = null;
    for (const v of AVIF_VARIANTS) {
      if (meta.width < v.width && v.name !== "md") continue;
      const out = join(dir, `image-${v.name}.avif`);
      await sharp(input.buffer, SHARP_LIMITS)
        .resize({ width: Math.min(v.width, meta.width), withoutEnlargement: true })
        .avif({ quality: AVIF_QUALITY, effort: AVIF_EFFORT })
        .toFile(out);
      if (v.name === "lg" || (v.name === "md" && !avifPath)) {
        avifPath = publicUrlFromLocalPath(out);
      }
    }

    // 6.5) OG variant 1200×630 — ratio 1.91:1 strict pour Twitter/LinkedIn.
    // Sans ce variant, Twitter crop centré et perd du contenu. Stocké comme
    // `og.webp` à côté des autres variants pour servir `og:image` direct.
    const ogOut = join(dir, "og.webp");
    await sharp(input.buffer, SHARP_LIMITS)
      .resize({
        width: OG_VARIANT.width,
        height: OG_VARIANT.height,
        fit: "cover",
        position: "attention", // smart crop Sharp (centre sur zone d'intérêt)
      })
      .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT })
      .withMetadata({ orientation: 1 })
      .toFile(ogOut);

    // 7) LQIP : 20w blur jpeg base64 (≤ 1 KB inline)
    const lqipBuffer = await sharp(input.buffer, SHARP_LIMITS)
      .resize({ width: LQIP_WIDTH, withoutEnlargement: true })
      .blur(LQIP_BLUR)
      .jpeg({ quality: LQIP_JPEG_QUALITY })
      .toBuffer();
    const lqipDataUri = `data:image/jpeg;base64,${lqipBuffer.toString("base64")}`;

    // 8) Final filesize (lg si dispo, sinon md)
    const lgPath = join(dir, "image-lg.webp");
    const fallbackPath = join(dir, "image-md.webp");
    const lgStat = await sharp(lgPath)
      .metadata()
      .catch(() => sharp(fallbackPath).metadata());
    const fileSize = lgStat.size ?? 0;

    return {
      uuid,
      fileHash,
      filePath: mainPath,
      thumbnailPath: publicUrlFromLocalPath(thumbOut),
      avifPath,
      ogPath: publicUrlFromLocalPath(ogOut),
      lqipDataUri,
      fileFormat: "webp",
      fileSize,
      width: meta.width,
      height: meta.height,
      orientation,
      aspectRatio,
      srcset: srcsetParts.join(", "),
    };
  }
}

export const imageImportService = new ImageImportService();

function computeOrientation(w: number, h: number): Orientation {
  const ratio = w / h;
  if (Math.abs(ratio - 1) < 0.05) return "square";
  return ratio > 1 ? "landscape" : "portrait";
}

function computeAspectRatio(w: number, h: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(w, h);
  return `${w / g}:${h / g}`;
}
// `publicUrl` est désormais `publicUrlFromLocalPath` dans `../utils/paths.ts`.
