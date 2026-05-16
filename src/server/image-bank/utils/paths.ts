// Template : src/server/image-bank/utils/paths.ts
//
// Helpers de manipulation des chemins/URLs d'image. Centralise les transformations
// `image-lg.webp` ↔ `image-md.webp` ↔ AVIF répétées dans 3+ services.

import {
  DOWNLOAD_SEGMENT,
  GALLERY_SEGMENT,
  STORAGE_URL_PREFIX,
  type ImageBankLocale,
} from "../constants";

/** Variant cible disponible. */
export type VariantTarget = "sm" | "md" | "lg" | "xl" | "thumbnail" | "avif-md" | "avif-lg";

/**
 * Convertit un chemin de variant vers un autre.
 *
 * Exemples :
 *   variantPathFor("/image-bank/abc/image-lg.webp", "md")     → "/image-bank/abc/image-md.webp"
 *   variantPathFor("/image-bank/abc/image-lg.webp", "avif-md") → "/image-bank/abc/image-md.avif"
 *   variantPathFor("/image-bank/abc/image-lg.webp", "thumbnail") → "/image-bank/abc/thumb.webp"
 */
export function variantPathFor(filePath: string, target: VariantTarget): string {
  const ext = target.startsWith("avif") ? "avif" : "webp";
  const baseName =
    target === "thumbnail"
      ? "thumb"
      : target === "avif-md"
        ? "image-md"
        : target === "avif-lg"
          ? "image-lg"
          : `image-${target}`;
  return filePath.replace(/image-(sm|md|lg|xl)\.(webp|avif|jpg|jpeg|png)$/, `${baseName}.${ext}`);
}

/**
 * Absolutise une URL relative en utilisant `SITE_URL` du caller.
 * Préserve les URLs déjà absolues.
 */
export function absoluteUrl(siteUrl: string, path: string): string {
  if (path.startsWith("http")) return path;
  return `${siteUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Page URL absolue d'une image (détail). */
export function pageUrlFor(siteUrl: string, locale: ImageBankLocale, slug: string): string {
  return `${siteUrl}/${locale}/${GALLERY_SEGMENT[locale]}/${slug}`;
}

/** URL absolue du téléchargement watermarké. */
export function downloadUrlFor(siteUrl: string, locale: ImageBankLocale, slug: string): string {
  return `${siteUrl}/${locale}/${GALLERY_SEGMENT[locale]}/${slug}/${DOWNLOAD_SEGMENT[locale]}`;
}

/** URL absolue de la galerie index. */
export function galleryIndexUrlFor(siteUrl: string, locale: ImageBankLocale): string {
  return `${siteUrl}/${locale}/${GALLERY_SEGMENT[locale]}/`;
}

/** Convertit un chemin local `public/image-bank/uuid/xxx.webp` en URL publique. */
export function publicUrlFromLocalPath(filePath: string): string {
  return "/" + filePath.replace(/^public\//, "").replace(/\\/g, "/");
}

/** Storage base path selon NODE_ENV (dev = public/, prod = S3 ou /var/data). */
export function getStorageBasePath(): string {
  if (process.env.NODE_ENV === "production") {
    return process.env.IMAGE_BANK_STORAGE_PATH ?? "/var/data/image-bank";
  }
  return `public${STORAGE_URL_PREFIX}`;
}
