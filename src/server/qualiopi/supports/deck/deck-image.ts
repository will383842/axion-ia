/**
 * Qualiopi — Supports : images d'illustration du diaporama (fail-soft).
 *
 * react-pdf et pptxgenjs ne lisent que PNG/JPG, or les illustrations du site sont
 * en AVIF/WebP. On convertit à la volée via `sharp` (déjà dépendance de la banque
 * d'images) en data URI PNG. Tout échec (fichier absent, sharp indisponible) est
 * FAIL-SOFT : on retourne `{}` et le deck se rend sans image (fonds unis).
 *
 * Cache mémoire process (les mêmes images servent les 17 formations).
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

const PUBLIC_DIR = path.join(process.cwd(), "public");

// Illustrations génériques adaptées à toute formation IA (banque locale AVIF).
const IMAGE_FILES: Record<string, string> = {
  cover: "illustrations/formations/salle-formation-ia-entreprise-sur-site.avif",
  section: "illustrations/formations/equipe-pme-formation-ia-atelier-pratique.avif",
};

const cache = new Map<string, string | null>();

/** Convertit un fichier image (AVIF/WebP/…) en data URI PNG. Null si échec. */
async function toPngDataUri(relPath: string): Promise<string | null> {
  if (cache.has(relPath)) return cache.get(relPath) ?? null;
  try {
    const sharp = (await import("sharp")).default;
    const buf = await readFile(path.join(PUBLIC_DIR, relPath));
    const png = await sharp(buf).resize(900, 900, { fit: "cover" }).png({ quality: 80 }).toBuffer();
    const uri = `data:image/png;base64,${png.toString("base64")}`;
    cache.set(relPath, uri);
    return uri;
  } catch {
    cache.set(relPath, null);
    return null;
  }
}

/**
 * Retourne les images du deck (par clé) en data URI PNG. Fail-soft : les clés
 * dont la conversion échoue sont simplement absentes du résultat.
 */
export async function loadDeckImages(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [key, file] of Object.entries(IMAGE_FILES)) {
    const uri = await toPngDataUri(file);
    if (uri) out[key] = uri;
  }
  return out;
}
