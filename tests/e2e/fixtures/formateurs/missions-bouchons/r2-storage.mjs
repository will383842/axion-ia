// Banc @formateurs — `@/lib/r2-storage` : le stockage objet du banc est un DOSSIER.
//
// Le job du banc n'a aucun seau R2 (cf. `banc-formateurs.yml`, « Stockage »). Sans
// stockage, aucune pièce signée ne s'archive et F28 / F19 ne s'enfilent jamais : le
// banc ne pourrait rien en dire. Dans le SEUL processus du banc, les fonctions qui
// écrivent ou lisent un objet passent donc par un dossier local
// (`/tmp/banc-formateurs/stockage/r2`). Tout le reste du module est le vrai.
//
// ⚠️ Le WORKER, lui, n'a pas ce dossier : un e-mail portant une pièce jointe reste
// en file (« PJ introuvable », réessais). Le banc constate donc ces envois à
// l'ENFILAGE (journal), pas au puits SMTP.

import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { documentPdfKey } from "../../../../../src/lib/r2-storage.ts?reel";

export * from "../../../../../src/lib/r2-storage.ts?reel";

const RACINE = path.join(
  process.env["IMAGE_BANK_STORAGE_PATH"]
    ? path.dirname(process.env["IMAGE_BANK_STORAGE_PATH"])
    : "/tmp/banc-formateurs/stockage",
  "r2",
);

function chemin(cle) {
  const propre = path.normalize(String(cle)).replace(/^(\.\.(\/|\\|$))+/, "");
  return path.join(RACINE, propre);
}

export function isR2Configured() {
  return true;
}

export async function uploadToR2(key, buffer, _contentType = "application/pdf", _metadata) {
  const c = chemin(key);
  await mkdir(path.dirname(c), { recursive: true });
  await writeFile(c, Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
  return { key, etag: "banc" };
}

export async function getSignedUrlR2(key) {
  return `https://stockage.banc.invalid/${encodeURI(key)}`;
}

export async function existsInR2(key) {
  try {
    await stat(chemin(key));
    return true;
  } catch {
    return false;
  }
}

export async function deleteFromR2(key) {
  await rm(chemin(key), { force: true });
}

export async function getObjectBufferR2(key) {
  try {
    return await readFile(chemin(key));
  } catch {
    return null;
  }
}

export async function signedDocumentPdfUrl(doc, ttlSeconds) {
  return getSignedUrlR2(documentPdfKey(doc), ttlSeconds);
}
