// Template : src/server/image-bank/services/image-import.service.ts
//
// Sharp pipeline : original → variants WebP + AVIF + LQIP + thumbnail.
//
// Doctrine Axion-IA :
//   - Sharp `limitInputPixels: 100_000_000` (anti zip-bomb)
//   - SHA-256 dedup avant écriture
//   - Storage local en dev (`public/image-bank/{uuid}/...`), S3 Hetzner en prod
//   - AUCUN `.withMetadata()` : c'est son ABSENCE qui strippe l'EXIF (cf. § RGPD)
//   - `.autoOrient()` sur chaque variant : la rotation est cuite dans les pixels
//   - Slugs ASCII via slugify strict
//
// Voir spec détaillée : `references/responsive-variants.md`.

import { createHash, randomUUID } from "node:crypto";
import { mkdir, stat } from "node:fs/promises";
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

    // 3.5) 🔴 RGPD + ORIENTATION — lire ceci avant de toucher au pipeline Sharp.
    //
    // Ce bloc affirmait l'inverse de ce que le code faisait. Rectifié le
    // 2026-08-16 (audit GEO/AEO, GEO-091/GEO-092), contre-épreuve à l'appui sur
    // une photo de téléphone simulée (orientation EXIF 6 + tag GPS 0x8825).
    //
    // ⚠️ `.withMetadata()` ne strippe RIEN — il CONSERVE. Sa documentation :
    //    « Include all metadata (EXIF, XMP, IPTC) from the input image in the
    //      output image. The default behaviour, when withMetadata is NOT used,
    //      is to strip all metadata. »
    //    Mesuré : EXIF d'entrée 300 octets → sortie 300 octets, tag GPS 0x8825
    //    toujours là. Sans l'appel : 0 octet, GPS parti. C'est donc l'ABSENCE
    //    d'appel qui protège. Ne le réintroduisez pas « pour normaliser ».
    //
    // ⚠️ `withMetadata({ orientation: 1 })` était pire qu'inutile : il écrasait
    //    le tag « pivote-moi » SANS faire pivoter les pixels. Une photo prise en
    //    portrait ressortait couchée (mesuré : 200×150 au lieu de 200×267), et
    //    le navigateur ne pouvait plus la redresser puisque l'indice avait été
    //    effacé. `.autoOrient()` cuit la rotation dans les pixels — après quoi
    //    plus aucun tag n'est nécessaire.
    //
    // 🔑 Les deux corrections sont INDISSOCIABLES. `metadata()` documente que
    //    `width`/`height` sont les pixels STOCKÉS, « EXIF orientation is not
    //    taken into consideration ». Une photo portrait de téléphone est stockée
    //    en paysage. Ne corriger que l'EXIF publierait des images couchées ; ne
    //    corriger que la rotation laisserait les dimensions inversées en base
    //    (mauvais ratio → CLS, mauvaise facette `orientation`). On lit donc
    //    partout `meta.autoOrient`, jamais `meta.width`/`meta.height`.
    //
    // Pour conserver volontairement une position (photo de lieu), le caller la
    // recopie dans `image.geoPosition` ; le fichier livré, lui, n'en porte jamais.
    const largeur = meta.autoOrient.width;
    const hauteur = meta.autoOrient.height;

    const orientation = computeOrientation(largeur, hauteur);
    const aspectRatio = computeAspectRatio(largeur, hauteur);

    // 4) Variants WebP — boucle sm/md/lg/xl (skip si > source width)
    const srcsetParts: string[] = [];
    let mainPath = "";
    for (const v of WEBP_VARIANTS) {
      if (largeur < v.width && v.name !== "sm") continue;
      const out = join(dir, `image-${v.name}.webp`);
      await sharp(input.buffer, SHARP_LIMITS)
        .autoOrient()
        .resize({ width: Math.min(v.width, largeur), withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT })
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
      .autoOrient()
      .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT })
      .toFile(thumbOut);

    // 6) AVIF — md/lg (qualité 55 = visuellement équivalent à WebP 80, mais plus léger)
    let avifPath: string | null = null;
    for (const v of AVIF_VARIANTS) {
      if (largeur < v.width && v.name !== "md") continue;
      const out = join(dir, `image-${v.name}.avif`);
      await sharp(input.buffer, SHARP_LIMITS)
        .autoOrient()
        .resize({ width: Math.min(v.width, largeur), withoutEnlargement: true })
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
      .autoOrient()
      .resize({
        width: OG_VARIANT.width,
        height: OG_VARIANT.height,
        fit: "cover",
        position: "attention", // smart crop Sharp (centre sur zone d'intérêt)
      })
      .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT })
      .toFile(ogOut);

    // 7) LQIP : 20w blur jpeg base64 (≤ 1 KB inline)
    const lqipBuffer = await sharp(input.buffer, SHARP_LIMITS)
      .autoOrient() // sinon l'aperçu flou sort dans l'autre sens que l'image finale
      .resize({ width: LQIP_WIDTH, withoutEnlargement: true })
      .blur(LQIP_BLUR)
      .jpeg({ quality: LQIP_JPEG_QUALITY })
      .toBuffer();
    const lqipDataUri = `data:image/jpeg;base64,${lqipBuffer.toString("base64")}`;

    // 8) Poids du fichier livré (lg si dispo, sinon md).
    //
    // 🔴 Rectifié le 2026-08-16 : ce bloc lisait `sharp(chemin).metadata().size`,
    // qui vaut TOUJOURS `undefined` — la propriété est documentée « Total size of
    // image in bytes, for Stream and Buffer input only », et un chemin de fichier
    // n'est ni l'un ni l'autre. Le `?? 0` transformait ce trou en un zéro
    // plausible : **toutes** les images de la banque portaient `fileSize = 0`,
    // sans erreur ni journal. Mesuré : `sharp(CHEMIN).metadata().size` →
    // `undefined`, `sharp(BUFFER)` → 142, fichier réel → 142 octets.
    // On demande donc sa taille au système de fichiers, seul à la connaître.
    const lgPath = join(dir, "image-lg.webp");
    const fallbackPath = join(dir, "image-md.webp");
    const fileSize = await stat(lgPath)
      .then((s) => s.size)
      .catch(() => stat(fallbackPath).then((s) => s.size))
      .catch(() => 0);

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
      width: largeur,
      height: hauteur,
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
