/**
 * LIEN SIGNÉ DE LECTURE D'UN FICHIER DE GUIDE RANGÉ SUR LE VOLUME (G4) — HMAC de 10 minutes.
 * Secret distinct (`GUIDES_RESEAU_FICHIER_SECRET`). Module pur : aucun accès base ni disque.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const VALIDITE_LIEN_FICHIER_S = 600;

function mac(secret: string, code: string, version: number, expire: number): string {
  return createHmac("sha256", secret)
    .update(`fichier-guide\n${code}\n${version}\n${expire}`)
    .digest("hex");
}

export function signerLienFichier(
  secret: string,
  code: string,
  version: number,
  maintenantSec: number = Math.floor(Date.now() / 1000),
): { e: number; s: string } {
  const e = maintenantSec + VALIDITE_LIEN_FICHIER_S;
  return { e, s: mac(secret, code, version, e) };
}

export function verifierLienFichier(
  secret: string,
  code: string,
  version: number,
  e: number,
  s: string,
  maintenantSec: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!Number.isInteger(e) || e < maintenantSec || e > maintenantSec + VALIDITE_LIEN_FICHIER_S)
    return false;
  if (!/^[0-9a-f]{64}$/.test(s)) return false;
  return timingSafeEqual(Buffer.from(mac(secret, code, version, e)), Buffer.from(s));
}
