// Stockage de la photo PUBLIQUE d'un avis (générée à l'approbation admin).
//
// À la publication, la photo privée (dépôt) est optimisée par Sharp :
//   - `.rotate()` : auto-orientation depuis l'EXIF PUIS suppression des métadonnées
//     (Sharp retire EXIF/GPS par défaut) → RGPD (pas de géoloc résiduelle).
//   - recadrage carré 512 + WebP qualité 82.
// Le résultat est écrit sur un volume dédié et servi par /api/avis/photo/[id].

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const PHOTO_SIZE = 512;

/** Base de stockage des photos publiques d'avis (volume Coolify en prod). */
export function getReviewMediaBasePath(): string {
  if (process.env.NODE_ENV === "production") {
    return process.env.REVIEW_MEDIA_PATH ?? "/var/data/reviews-media";
  }
  return path.join(process.cwd(), ".reviews-media");
}

/** UUID sûr pour nom de fichier (défense path-traversal). */
function safeId(id: string): string {
  return id.replace(/[^a-z0-9-]/gi, "").slice(0, 64);
}

/**
 * Optimise + stocke la photo publique d'un avis. Retourne l'URL publique
 * (`/api/avis/photo/<id>`) à persister dans `photoUrl`.
 */
export async function storeReviewPhotoPublic(
  privateBuf: Buffer,
  reviewId: string,
): Promise<string> {
  const id = safeId(reviewId);
  const out = await sharp(privateBuf)
    .rotate()
    .resize(PHOTO_SIZE, PHOTO_SIZE, { fit: "cover", position: "attention" })
    .webp({ quality: 82 })
    .toBuffer();
  const base = getReviewMediaBasePath();
  await fs.mkdir(base, { recursive: true });
  await fs.writeFile(path.join(base, `${id}.webp`), out);
  return `/api/avis/photo/${id}`;
}

/** Lit la photo publique d'un avis (null si absente). */
export async function readReviewPhotoPublic(reviewId: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(getReviewMediaBasePath(), `${safeId(reviewId)}.webp`));
  } catch {
    return null;
  }
}

/** Supprime la photo publique d'un avis (RGPD / suppression). Idempotent. */
export async function deleteReviewPhotoPublic(reviewId: string): Promise<void> {
  try {
    await fs.unlink(path.join(getReviewMediaBasePath(), `${safeId(reviewId)}.webp`));
  } catch {
    // absente → no-op
  }
}
