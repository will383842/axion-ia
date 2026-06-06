/**
 * Qualiopi — Tokens QR de vérification publique.
 *
 * `makeQrToken`      : génère un token aléatoire 32 bytes = 64 hex.
 * `qrDataUrl`        : encode un texte en QR code data:image/png;base64.
 * `verifyQrToken`    : comparaison timing-safe des tokens.
 *
 * Utilisé sur les attestations et certificats de réalisation pour la
 * vérification publique via `/verifier-attestation/[token]`.
 */

import { randomBytes, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";

/**
 * Génère un token QR aléatoire (32 bytes = 64 caractères hex).
 * Chaque document reçoit un token unique non-guessable.
 */
export function makeQrToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Encode un texte (typiquement l'URL de vérification) en QR code PNG.
 * Retourne une data URL `data:image/png;base64,...` prête pour <Image src>.
 *
 * @param text — texte à encoder (URL de vérification publique).
 * @returns data URL PNG base64.
 */
export async function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { width: 160, margin: 1 });
}

/**
 * Vérifie en temps constant si deux tokens QR sont identiques.
 * Protège contre les attaques temporelles (timing attacks).
 *
 * Gère les longueurs différentes sans throw (retourne false).
 */
export function verifyQrToken(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}
