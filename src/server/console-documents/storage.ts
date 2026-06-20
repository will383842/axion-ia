// Stockage des documents console (hub « Documents ») — VOLUME DISQUE dédié,
// HORS web-root. Ces fichiers ne sont JAMAIS servis en statique : téléchargement
// via route admin authentifiée uniquement (cf. fichiers/[id]/route.ts).
//
// Helper DÉDIÉ (ne pas réutiliser getCvStorageBasePath ni l'image-bank) — même
// doctrine que `src/server/careers/cv-storage.ts` : volume Coolify en prod,
// dossier git-ignoré hors public/ en dev.
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { join, extname } from "node:path";
import { createHash, randomUUID } from "node:crypto";

/** Racine de stockage des documents console. Prod = volume Coolify ; dev = dossier git-ignoré. */
export function getConsoleDocsBasePath(): string {
  if (process.env.NODE_ENV === "production") {
    return process.env.CONSOLE_DOCS_PATH ?? "/var/data/console-docs";
  }
  return process.env.CONSOLE_DOCS_PATH ?? ".console-docs";
}

/** Extensions autorisées (miroir de la validation Zod côté Server Action). */
export const CONSOLE_DOC_ALLOWED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
] as const;

export const CONSOLE_DOC_ALLOWED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const CONSOLE_DOC_MAX_BYTES = 10 * 1024 * 1024; // 10 Mo (= bodySizeLimit server actions)

/** Nettoie un nom de fichier (anti path-traversal), conserve l'extension. */
export function sanitizeConsoleDocFileName(name: string): string {
  const ext = extname(name).toLowerCase();
  const base =
    name
      .slice(0, name.length - ext.length)
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "document";
  return `${base}${ext}`;
}

export interface StoredConsoleDoc {
  /** Chemin absolu de stockage (à persister en DB). */
  storagePath: string;
  /** SHA-256 hex du contenu (intégrité). */
  hashSha256: string;
}

/** Écrit un document sur disque + calcule son hash. Retourne le chemin + hash à persister. */
export async function storeConsoleDoc(
  buffer: Buffer,
  originalName: string,
): Promise<StoredConsoleDoc> {
  const dir = join(getConsoleDocsBasePath(), randomUUID());
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, sanitizeConsoleDocFileName(originalName));
  await writeFile(filePath, buffer);
  const hashSha256 = createHash("sha256").update(buffer).digest("hex");
  return { storagePath: filePath, hashSha256 };
}

/** Lit un document depuis le disque (route admin authentifiée uniquement). */
export async function readConsoleDoc(storagePath: string): Promise<Buffer> {
  return readFile(storagePath);
}

/** Supprime un document du disque. Best-effort, idempotent. */
export async function deleteConsoleDocFile(storagePath: string | null | undefined): Promise<void> {
  if (!storagePath) return;
  try {
    await unlink(storagePath);
  } catch {
    // déjà absent / déjà purgé — no-op
  }
}
