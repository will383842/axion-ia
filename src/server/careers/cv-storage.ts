// Stockage des CV de candidature — VOLUME DISQUE dédié, HORS web-root.
// Les CV ne sont JAMAIS servis en statique : téléchargement via route admin
// authentifiée uniquement (cf. L4). Helper DÉDIÉ : ne PAS réutiliser
// getStorageBasePath() de l'image-bank (pointe /var/data/image-bank + couplé Sharp).
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";

/** Racine de stockage des CV. Prod = volume Coolify ; dev = dossier git-ignoré hors public/. */
export function getCvStorageBasePath(): string {
  if (process.env.NODE_ENV === "production") {
    return process.env.CV_STORAGE_PATH ?? "/var/data/cv";
  }
  return process.env.CV_STORAGE_PATH ?? ".cv-storage";
}

/** Extensions de CV autorisées (miroir de la validation Zod côté Server Action). */
export const CV_ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"] as const;
export const CV_ALLOWED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;
export const CV_MAX_BYTES = 8 * 1024 * 1024; // 8 Mo

/** Nettoie un nom de fichier (anti path-traversal), conserve l'extension. */
export function sanitizeCvFileName(name: string): string {
  const ext = extname(name).toLowerCase();
  const base =
    name
      .slice(0, name.length - ext.length)
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "cv";
  return `${base}${ext}`;
}

/** Écrit un CV sur disque, retourne son chemin absolu de stockage (à persister en DB). */
export async function storeCv(buffer: Buffer, originalName: string): Promise<string> {
  const dir = join(getCvStorageBasePath(), randomUUID());
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, sanitizeCvFileName(originalName));
  await writeFile(filePath, buffer);
  return filePath;
}

/** Lit un CV depuis le disque (route admin authentifiée uniquement). */
export async function readCv(storagePath: string): Promise<Buffer> {
  return readFile(storagePath);
}

/** Supprime un CV du disque (droit à l'effacement RGPD). Best-effort, idempotent. */
export async function deleteCv(storagePath: string | null | undefined): Promise<void> {
  if (!storagePath) return;
  try {
    await unlink(storagePath);
  } catch {
    // déjà absent / déjà purgé — no-op
  }
}
