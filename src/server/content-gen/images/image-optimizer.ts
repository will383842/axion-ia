/**
 * Content Generator — Image optimizer sharp (AVIF/WebP/JPG variants).
 *
 * Sprint 1 Day 4 AGT-B (§ 8 master prompt + § 9.7.9 anti-CLS).
 *
 * Pipeline :
 * 1. Fetch image source (Unsplash regular URL).
 * 2. Resize via sharp en 3 variants responsive : 320w / 768w / 1280w.
 * 3. Export AVIF (quality 70) + WebP (quality 80) + JPG fallback (quality 85).
 * 4. Store dans `public/illustrations/generated/content-gen/{photoId}/{variant}.{ext}`.
 * 5. Return manifest avec width/height + srcset string.
 *
 * Contraintes anti-CLS : width + height ALWAYS persistés (cf. checklists/seo-aeo-60-items.md).
 */

import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";

export interface OptimizedImageVariant {
  readonly width: number;
  readonly format: "avif" | "webp" | "jpg";
  readonly path: string; // relative public/ path
  readonly bytes: number;
}

export interface OptimizedImageManifest {
  readonly photoId: string;
  readonly originalWidth: number;
  readonly originalHeight: number;
  readonly variants: ReadonlyArray<OptimizedImageVariant>;
  readonly srcset: {
    readonly avif: string;
    readonly webp: string;
    readonly jpg: string;
  };
}

const WIDTHS = [320, 768, 1280] as const;
const AVIF_QUALITY = 70;
const WEBP_QUALITY = 80;
const JPG_QUALITY = 85;

const PUBLIC_DIR = path.join(process.cwd(), "public");
const ILLUSTRATIONS_DIR = "illustrations/generated/content-gen";

/**
 * Télécharge + optimise + persiste les 9 variants (3 widths × 3 formats).
 * V0 transitoire : aucune deduplication — chaque appel regénère.
 * V2 ajoutera cache `photoId` → manifest dans DB `ContentMetric.imageMetadata`.
 */
export async function optimizeImage(
  photoId: string,
  sourceUrl: string,
): Promise<OptimizedImageManifest> {
  // 1. Fetch
  const res = await fetch(sourceUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch image ${sourceUrl}: ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 2. Probe original dimensions
  const meta = await sharp(buffer).metadata();
  const originalWidth = meta.width ?? 0;
  const originalHeight = meta.height ?? 0;
  if (originalWidth === 0 || originalHeight === 0) {
    throw new Error(`Invalid image metadata for ${photoId}`);
  }

  // 3. Create output dir
  const outDir = path.join(PUBLIC_DIR, ILLUSTRATIONS_DIR, photoId);
  await fs.mkdir(outDir, { recursive: true });

  const variants: OptimizedImageVariant[] = [];
  const srcsetAvif: string[] = [];
  const srcsetWebp: string[] = [];
  const srcsetJpg: string[] = [];

  for (const width of WIDTHS) {
    if (width > originalWidth) continue; // skip upsizing

    // AVIF
    const avifBuf = await sharp(buffer)
      .resize({ width })
      .avif({ quality: AVIF_QUALITY })
      .toBuffer();
    const avifRel = `${ILLUSTRATIONS_DIR}/${photoId}/${width}.avif`;
    await fs.writeFile(path.join(PUBLIC_DIR, avifRel), avifBuf);
    variants.push({ width, format: "avif", path: `/${avifRel}`, bytes: avifBuf.length });
    srcsetAvif.push(`/${avifRel} ${width}w`);

    // WebP
    const webpBuf = await sharp(buffer)
      .resize({ width })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    const webpRel = `${ILLUSTRATIONS_DIR}/${photoId}/${width}.webp`;
    await fs.writeFile(path.join(PUBLIC_DIR, webpRel), webpBuf);
    variants.push({ width, format: "webp", path: `/${webpRel}`, bytes: webpBuf.length });
    srcsetWebp.push(`/${webpRel} ${width}w`);

    // JPG fallback
    const jpgBuf = await sharp(buffer)
      .resize({ width })
      .jpeg({ quality: JPG_QUALITY, mozjpeg: true })
      .toBuffer();
    const jpgRel = `${ILLUSTRATIONS_DIR}/${photoId}/${width}.jpg`;
    await fs.writeFile(path.join(PUBLIC_DIR, jpgRel), jpgBuf);
    variants.push({ width, format: "jpg", path: `/${jpgRel}`, bytes: jpgBuf.length });
    srcsetJpg.push(`/${jpgRel} ${width}w`);
  }

  return {
    photoId,
    originalWidth,
    originalHeight,
    variants,
    srcset: {
      avif: srcsetAvif.join(", "),
      webp: srcsetWebp.join(", "),
      jpg: srcsetJpg.join(", "),
    },
  };
}
