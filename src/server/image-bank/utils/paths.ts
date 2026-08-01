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

/**
 * Résout l'URL d'affichage d'une miniature admin (audit UX 2026-08 — la console
 * n'affichait AUCUNE vraie image nulle part, un carré gris partout, sur une
 * bibliothèque de 200+ images choisies à l'aveugle par titre/slug).
 *
 * Gère les deux familles de stockage déjà en place côté public (`GalleryGrid`) :
 *   - UUID-based (upload admin, Docker volume ou CDN) : `thumbnailPath`/`filePath`
 *     commencent par `/image-bank` → préfixés par `IMAGE_BANK_CDN_URL` (vide en
 *     dev → chemin relatif servi par le même serveur).
 *   - Slug-based (images seedées dans `public/images/…`) : chemin relatif sans
 *     slash de tête → normalisé avec un slash unique.
 *
 * Priorité `thumbnailPath` (variant Sharp basse résolution, ~300px, généré au
 * pipeline d'import) → repli sur `filePath` (image principale) si la miniature
 * n'a pas encore été générée → `null` si aucune des deux n'existe (import en
 * échec ou en cours) : dans ce cas l'appelant garde le placeholder gris.
 */
export function resolveAdminThumbSrc(
  image: { id: string; thumbnailPath?: string | null; filePath?: string | null },
  baseUrl: string = process.env.IMAGE_BANK_CDN_URL ?? "",
): string | null {
  const path = image.thumbnailPath || image.filePath;
  if (!path) return null;
  if (path.startsWith("/image-bank")) return `${baseUrl}${path}`;
  // Upload admin en PROD : `publicUrlFromLocalPath` a stocké le chemin DISQUE
  // du volume (`//var/data/image-bank/…`), qui n'est pas une URL servable.
  // On reconstruit l'URL comme le fait la galerie publique (`GalleryGrid`,
  // motif prouvé en prod) : `{CDN}/image-bank/{uuid}/…` — `thumb.webp` vit
  // dans le même dossier que les variants servis.
  if (path.includes("/var/data/") || path.startsWith("//")) {
    return `${baseUrl}/image-bank/${image.id}/thumb.webp`;
  }
  return path.startsWith("/") ? path : `/${path}`;
}
