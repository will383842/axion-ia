/**
 * KB V4 — HMAC-SHA256 pour authentification factory ingest API.
 *
 * Header `X-KB-Signature` requis. Secret env `KB_INGEST_SECRET`.
 * Signature = HMAC-SHA256(body_raw, secret).
 *
 * Côté factory : signer chaque POST avec la même clé partagée.
 */

import crypto from "node:crypto";

/**
 * Calcule la signature HMAC-SHA256 d'un body.
 * Retourne l'hex string.
 */
export function computeKbSignature(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

/**
 * Vérifie une signature reçue.
 * Comparaison constante-temps (anti-timing attacks).
 */
export function verifyKbSignature(body: string, signature: string, secret: string): boolean {
  const expected = computeKbSignature(body, secret);
  if (expected.length !== signature.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

/**
 * Récupère le secret depuis env. Throw si absent (config bug).
 */
export function getKbIngestSecret(): string {
  const secret = process.env.KB_INGEST_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "KB_INGEST_SECRET env var manquante ou trop courte (min 32 chars). Voir .env.dev.example.",
    );
  }
  return secret;
}
