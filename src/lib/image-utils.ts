/**
 * image-utils.ts — Helpers Sharp génériques partagés content-gen + image-bank
 *
 * Refactor extraction GAP-25 : avant ce fichier, les helpers Sharp étaient
 * dupliqués dans `src/server/content-gen/images/image-optimizer.ts` et seraient
 * dupliqués à nouveau dans `src/server/image-bank/services/image-import.service.ts`.
 *
 * Économie estimée : ~10h dev + maintenance long-terme.
 *
 * À placer dans `axionia/src/lib/image-utils.ts` (path SSOT pour content-gen + image-bank).
 *
 * @see axionia/_AUDIT/PROMPT-IMAGE-BANK-AUDIT-AUTOPILOT-2026.md GAP-25
 */

import sharp, { type Metadata, type Sharp } from "sharp";
import { createHash } from "node:crypto";

// ──────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────

// ✨ Limites anti-DoS (Sprint 1 patch)
export const MAX_FILE_SIZE_SYNC_BYTES = 5 * 1024 * 1024; // 5 MB sync upload
export const MAX_FILE_SIZE_ASYNC_BYTES = 50 * 1024 * 1024; // 50 MB async worker (bulk-import)
export const MAX_INPUT_PIXELS = 100_000_000; // 100 MP Sharp `limitInputPixels` anti-pixel-bomb

export const WIDTH_VARIANTS = {
  thumb: 300,
  sm: 640,
  md: 960,
  lg: 1200,
  xl: 1920,
} as const;

export const OG_VARIANT = { width: 1200, height: 630 };
export const SQUARE_VARIANT = { width: 1080, height: 1080 };

export const WEBP_QUALITY = 80;
export const AVIF_QUALITY = 60;
export const AVIF_EFFORT_SYNC = 6; // décision défaut (cf. stop-and-ask)
export const AVIF_EFFORT_ASYNC = 9; // worker batch V1.1

// MIME types acceptés
export const ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
] as const;

// Magic bytes par MIME (validation sécurité)
const MAGIC_BYTES: Array<{ mime: string; bytes: number[] }> = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF (suivi de WEBP à offset 8)
  { mime: "image/avif", bytes: [0x00, 0x00, 0x00] }, // suivi de ftyp avif/heic à offset 4
];

// ──────────────────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────────────────

/**
 * Vérifie les magic bytes du buffer. Retourne le MIME détecté ou null.
 */
export function detectMimeFromMagicBytes(buffer: Buffer): string | null {
  for (const { mime, bytes } of MAGIC_BYTES) {
    const match = bytes.every((b, i) => buffer[i] === b);
    if (match) {
      if (mime === "image/webp" && buffer.slice(8, 12).toString() !== "WEBP") continue;
      if (mime === "image/avif") {
        const ftyp = buffer.slice(4, 8).toString();
        if (ftyp !== "ftyp") continue;
        const brand = buffer.slice(8, 12).toString();
        if (brand !== "avif" && brand !== "avis" && brand !== "heic") continue;
      }
      return mime;
    }
  }
  return null;
}

export function isAcceptedMime(mime: string): boolean {
  return (ACCEPTED_MIME_TYPES as readonly string[]).includes(mime);
}

// ──────────────────────────────────────────────────────────
// Hashing
// ──────────────────────────────────────────────────────────

export function sha256Buffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

// ──────────────────────────────────────────────────────────
// Sharp pipeline helpers
// ──────────────────────────────────────────────────────────

/**
 * Strip EXIF en gardant uniquement l'orientation 1 (rotation neutre).
 * RGPD critique : GPS + datetime + camera info supprimés.
 */
export function stripExifPreserveOrientation(input: Sharp): Sharp {
  return input.withMetadata({ orientation: 1 });
}

export async function getImageMetadata(buffer: Buffer): Promise<Metadata> {
  return await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
}

/**
 * Anti-DoS validation au upload.
 * Throws ImageValidationError si fichier trop gros / mauvais format / pixel bomb.
 */
export class ImageValidationError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ImageValidationError";
  }
}

export async function validateUploadBuffer(
  buffer: Buffer,
  options: { mode: "sync" | "async" } = { mode: "sync" },
): Promise<{ mime: string; width: number; height: number }> {
  const maxBytes = options.mode === "sync" ? MAX_FILE_SIZE_SYNC_BYTES : MAX_FILE_SIZE_ASYNC_BYTES;
  if (buffer.length > maxBytes) {
    throw new ImageValidationError(
      "FILE_TOO_LARGE",
      `File size ${buffer.length} bytes exceeds ${maxBytes} bytes limit (mode=${options.mode})`,
    );
  }

  const mime = detectMimeFromMagicBytes(buffer);
  if (!mime || !isAcceptedMime(mime)) {
    throw new ImageValidationError(
      "INVALID_MIME",
      `Detected MIME '${mime ?? "unknown"}' not in accepted list ${ACCEPTED_MIME_TYPES.join(",")}`,
    );
  }

  let metadata: Metadata;
  try {
    metadata = await getImageMetadata(buffer);
  } catch (err) {
    throw new ImageValidationError(
      "SHARP_PARSE_FAILED",
      `Sharp parse error: ${(err as Error).message}`,
    );
  }

  if (!metadata.width || !metadata.height) {
    throw new ImageValidationError("MISSING_DIMENSIONS", "Image dimensions not found");
  }

  if (metadata.width * metadata.height > MAX_INPUT_PIXELS) {
    throw new ImageValidationError(
      "PIXEL_BOMB",
      `Image ${metadata.width}×${metadata.height} = ${metadata.width * metadata.height} pixels exceeds ${MAX_INPUT_PIXELS} limit`,
    );
  }

  return { mime, width: metadata.width, height: metadata.height };
}

/**
 * Convert vers WebP avec qualité standardisée.
 */
export async function toWebp(
  input: Sharp,
  options: { width?: number; quality?: number } = {},
): Promise<Buffer> {
  let pipeline = input.clone();
  if (options.width) {
    pipeline = pipeline.resize({ width: options.width, withoutEnlargement: true });
  }
  return await pipeline.webp({ quality: options.quality ?? WEBP_QUALITY, effort: 4 }).toBuffer();
}

/**
 * Convert vers AVIF.
 */
export async function toAvif(
  input: Sharp,
  options: { width?: number; quality?: number; effort?: number } = {},
): Promise<Buffer> {
  let pipeline = input.clone();
  if (options.width) {
    pipeline = pipeline.resize({ width: options.width, withoutEnlargement: true });
  }
  return await pipeline
    .avif({
      quality: options.quality ?? AVIF_QUALITY,
      effort: options.effort ?? AVIF_EFFORT_SYNC,
    })
    .toBuffer();
}

/**
 * Smart crop center-of-attention pour og.webp + square.webp.
 */
export async function toSmartCrop(
  input: Sharp,
  options: { width: number; height: number; format?: "webp" | "avif" },
): Promise<Buffer> {
  const pipeline = input.clone().resize({
    width: options.width,
    height: options.height,
    fit: "cover",
    position: sharp.strategy.attention, // smart crop visage/objet
  });

  return options.format === "avif"
    ? await pipeline.avif({ quality: AVIF_QUALITY, effort: AVIF_EFFORT_SYNC }).toBuffer()
    : await pipeline.webp({ quality: WEBP_QUALITY, effort: 4 }).toBuffer();
}

/**
 * LQIP (Low Quality Image Placeholder) base64 inline ≤ 1 KB.
 * 20px wide, blur 1.5, qualité 30.
 */
export async function generateLqip(input: Sharp): Promise<string> {
  const buffer = await input
    .clone()
    .resize({ width: 20, withoutEnlargement: true })
    .blur(1.5)
    .webp({ quality: 30 })
    .toBuffer();
  return `data:image/webp;base64,${buffer.toString("base64")}`;
}

/**
 * Génère tous les variants standards en parallèle.
 */
export async function generateAllVariants(args: {
  buffer: Buffer;
  width: number;
  height: number;
}): Promise<{
  webp: Record<keyof typeof WIDTH_VARIANTS, Buffer>;
  avif: { md: Buffer; lg: Buffer };
  og: Buffer;
  square: Buffer;
  lqip: string;
}> {
  const input = stripExifPreserveOrientation(sharp(args.buffer));

  const [thumbWebp, smWebp, mdWebp, lgWebp, xlWebp, mdAvif, lgAvif, og, square, lqip] =
    await Promise.all([
      toWebp(input, { width: WIDTH_VARIANTS.thumb }),
      toWebp(input, { width: WIDTH_VARIANTS.sm }),
      toWebp(input, { width: WIDTH_VARIANTS.md }),
      toWebp(input, { width: WIDTH_VARIANTS.lg }),
      toWebp(input, { width: WIDTH_VARIANTS.xl }),
      toAvif(input, { width: WIDTH_VARIANTS.md }),
      toAvif(input, { width: WIDTH_VARIANTS.lg }),
      toSmartCrop(input, { width: OG_VARIANT.width, height: OG_VARIANT.height, format: "webp" }),
      toSmartCrop(input, {
        width: SQUARE_VARIANT.width,
        height: SQUARE_VARIANT.height,
        format: "webp",
      }),
      generateLqip(input),
    ]);

  return {
    webp: { thumb: thumbWebp, sm: smWebp, md: mdWebp, lg: lgWebp, xl: xlWebp },
    avif: { md: mdAvif, lg: lgAvif },
    og,
    square,
    lqip,
  };
}

/**
 * Embed IPTC/XMP copyright via Sharp withMetadata.
 * Fallback exiftool CLI si dispo (V1.5).
 */
export async function embedCopyrightMetadata(
  input: Sharp,
  options: {
    year: number;
    creditText: string;
    licenseUrl: string;
  },
): Promise<Sharp> {
  return input.withMetadata({
    orientation: 1,
    icc: "sRGB",
    exif: {
      IFD0: {
        Copyright: `© ${options.year} ${options.creditText}. Licensed under CC BY 4.0 — ${options.licenseUrl}`,
      },
    },
  });
}

// ──────────────────────────────────────────────────────────
// File size budget guards
// ──────────────────────────────────────────────────────────

export const SIZE_BUDGETS_KB = {
  thumb: 30,
  sm: 60,
  md: 100,
  lg: 200, // LCP target
  xl: 350,
  mdAvif: 70,
  lgAvif: 130,
  og: 110,
  square: 130,
} as const;

export function bufferKb(buffer: Buffer): number {
  return Math.round((buffer.length / 1024) * 10) / 10;
}

export function assertBudget(buffer: Buffer, variant: keyof typeof SIZE_BUDGETS_KB): void {
  const sizeKb = bufferKb(buffer);
  const budget = SIZE_BUDGETS_KB[variant];
  if (sizeKb > budget) {
    console.warn(
      `[image-utils] Variant ${variant} = ${sizeKb} KB (budget ${budget} KB) — consider re-encoding`,
    );
  }
}
