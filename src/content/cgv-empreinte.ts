/**
 * Empreinte du TEXTE des CGV — définition UNIQUE du calcul.
 *
 * Utilisée par le cliquet de version (`__tests__/cgv-version.spec.ts`) ET par la signature d'un
 * devis (sceau V4 : `cgv_texte_sha256`). Deux définitions finiraient par diverger, et la preuve
 * affirmerait alors l'acceptation d'un texte que le cliquet ne reconnaît pas.
 *
 * Le texte est celui que le serveur sert : `JSON.stringify(getLegal("conditions-generales").fr)`.
 * Jamais une valeur venue du navigateur.
 */
import { createHash } from "node:crypto";
import { getLegal } from "@/content/legal";

/** Texte canonique des CGV françaises en vigueur. */
export function texteCanoniqueCgv(): string {
  return JSON.stringify(getLegal("conditions-generales").fr);
}

/** SHA-256 hex (64 caractères) du texte canonique des CGV françaises en vigueur. */
export function empreinteTexteCgv(): string {
  return createHash("sha256").update(texteCanoniqueCgv(), "utf8").digest("hex");
}
