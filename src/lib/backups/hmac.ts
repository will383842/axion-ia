/**
 * Backups & DR (ADR 0032) — HMAC-SHA256 pour l'ingestion du statut des backups.
 *
 * Header `X-Backup-Signature` requis. Secret env `BACKUP_INGEST_SECRET`.
 * Signature = HMAC-SHA256(body_raw, secret) en hex.
 *
 * Côté scripts (backup-lib.sh) : `openssl dgst -sha256 -hmac "$secret"`.
 * Même contrat que src/lib/knowledge/hmac.ts (module distinct par cloisonnement).
 */

import crypto from "node:crypto";

/** Calcule la signature HMAC-SHA256 d'un body. Retourne l'hex string. */
export function computeBackupSignature(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

/** Vérifie une signature reçue (comparaison constante-temps). */
export function verifyBackupSignature(body: string, signature: string, secret: string): boolean {
  const expected = computeBackupSignature(body, secret);
  if (expected.length !== signature.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

/** Récupère le secret depuis env. Throw si absent/trop court (config bug). */
export function getBackupIngestSecret(): string {
  const secret = process.env.BACKUP_INGEST_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "BACKUP_INGEST_SECRET env var manquante ou trop courte (min 32 chars). Voir .env.production.example.",
    );
  }
  return secret;
}
