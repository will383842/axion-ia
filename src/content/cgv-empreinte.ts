/**
 * Empreinte du texte des CGV : UNE seule définition du calcul.
 *
 * Utilisée par le cliquet de version (`__tests__/cgv-version.spec.ts`) ET par l'archive
 * immuable (`server/legal/cgv-archive.ts`). Sans `server-only` : atteignable par le worker.
 */
import { createHash } from "node:crypto";
import { getLegal } from "@/content/legal";

/** Texte canonique archivé : exactement le JSON du texte français publié. */
export function texteCanoniqueCgv(): string {
  return JSON.stringify(getLegal("conditions-generales").fr);
}

export function sha256Hex(donnees: string | Uint8Array): string {
  return createHash("sha256").update(donnees).digest("hex");
}

/** SHA-256 (hex minuscule) du texte canonique. */
export function empreinteTexteCgv(): string {
  return sha256Hex(texteCanoniqueCgv());
}
