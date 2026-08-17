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

/**
 * Convertit un chemin de fichier local en URL publique servable.
 *
 * 🔴 RECTIFIÉ le 2026-08-16 — GEO-094 (audit GEO/AEO du 2026-08-14, lot 18).
 *
 * L'implémentation précédente retirait le préfixe `public/` et ajoutait un `/`.
 * Ça marche en développement, où le stockage est `public/image-bank/…`. En
 * production, le stockage est un volume Docker `/var/data/image-bank/…`, qui
 * n'est pas sous `public/` : le chemin ressortait donc **inchangé, avec un `/`
 * de plus** → `//var/data/image-bank/<uuid>/image-lg.webp`.
 *
 * Un `//` de tête n'est pas un chemin : c'est une **URL protocole-relative**.
 * Le navigateur la résout en `https://var/data/…`, un hôte qui n'existe pas.
 * Autrement dit, les images téléversées depuis la console n'ont jamais pu
 * s'afficher en production. Le symptôme avait déjà été contourné à la main dans
 * `resolveAdminThumbSrc` le 2026-08-02, sans que la cause soit corrigée ici.
 *
 * 🔑 La forme servable est la même dans les deux environnements :
 * `/image-bank/<uuid>/<fichier>` — c'est ce que reconstruisent déjà TOUS les
 * consommateurs publics (galerie, carrousel presse, page détail), préfixé par
 * `IMAGE_BANK_CDN_URL` quand il est défini. On produit donc directement cette
 * forme, quelle que soit la racine de stockage.
 *
 * ⚠️ Côté infrastructure, `/image-bank/*` doit être servi depuis le volume
 * (Caddy ou CDN). C'est hors du dépôt, et c'est le prérequis de tout ce qui
 * précède.
 */
export function publicUrlFromLocalPath(filePath: string): string {
  const normalise = filePath.replace(/\\/g, "/");
  // On repart des DEUX derniers segments (`<uuid>/<fichier>`) : c'est
  // l'invariant du pipeline d'import, indépendant de la racine de stockage.
  const segments = normalise.split("/").filter(Boolean);
  const fichier = segments[segments.length - 1];
  const dossier = segments[segments.length - 2];
  if (fichier && dossier) {
    return `${STORAGE_URL_PREFIX}/${dossier}/${fichier}`;
  }
  // Repli : chemin inattendu (moins de deux segments) — on ne fabrique pas une
  // URL au hasard, on conserve l'ancien comportement.
  return "/" + normalise.replace(/^public\//, "");
}

/** Storage base path selon NODE_ENV (dev = public/, prod = S3 ou /var/data). */
export function getStorageBasePath(): string {
  if (process.env.NODE_ENV === "production") {
    // `?.trim() ||` et non `??` : une variable DÉFINIE mais VIDE (cas courant
    // quand on déclare la clé sans valeur dans un panneau de configuration)
    // n'est pas `null`, donc `??` la laissait passer et la racine devenait la
    // chaîne vide. Défaut trouvé par la garde en écrivant ce correctif.
    return process.env.IMAGE_BANK_STORAGE_PATH?.trim() || "/var/data/image-bank";
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
  // 🔴 Vérifié en production le 2026-08-02 : pour les images SEEDÉES sous
  // `public/images/…`, la base référence un `thumbnailPath` en `-thumb.webp`
  // que le disque ne porte PAS — le fichier n'a jamais été généré. Résultat :
  // 404 sur les 288 vignettes de la console, alors que l'image principale
  // répond 200 au même dossier. On préfère donc `filePath` pour cette famille.
  //
  // La famille UUID (upload admin) garde la priorité à `thumbnailPath` : son
  // variant Sharp existe bel et bien, et sert précisément à ne pas charger
  // l'original dans une liste.
  const estSeedee = (p: string): boolean =>
    !p.startsWith("/image-bank") && !p.includes("/var/data/") && !p.startsWith("//");
  const candidat = image.thumbnailPath ?? null;
  const path =
    candidat !== null && estSeedee(candidat)
      ? (image.filePath ?? candidat)
      : (candidat ?? image.filePath);
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
