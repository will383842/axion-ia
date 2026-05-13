// DocuSeal webhook verification (light — main branch).
//
// Version minimale pour que `/api/docuseal/webhook` retourne 200 OK en
// prod (au lieu de 404). Le client TS complet (createSubmission, etc.)
// arrive avec le merge feature/booking-v1 — Sprint X.3.
//
// SOURCE :
//   - ADR 0014 — DocuSeal self-hosted vs Yousign
//   - DocuSeal v2.x utilise `X-Docuseal-Secret` (plaintext) au lieu de
//     `X-Docuseal-Signature` (HMAC) des versions antérieures
//
// SÉCURITÉ :
//   - Comparaison timing-safe via `crypto.timingSafeEqual`
//   - `DOCUSEAL_WEBHOOK_SECRET` server-only (jamais exposé client)

import { createHmac, timingSafeEqual } from "node:crypto";

export function isDocusealWebhookConfigured(): boolean {
  return Boolean(process.env["DOCUSEAL_WEBHOOK_SECRET"]);
}

function getWebhookSecret(): string {
  const s = process.env["DOCUSEAL_WEBHOOK_SECRET"];
  if (!s) {
    throw new Error("DOCUSEAL_WEBHOOK_SECRET manquant.");
  }
  return s;
}

/**
 * Vérifie HMAC-SHA256 (format DocuSeal v1.x legacy).
 * Header : `X-Docuseal-Signature: <hex_digest>` (64 chars).
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  if (signatureHeader.length !== 64) return false;
  const expected = createHmac("sha256", getWebhookSecret()).update(rawBody, "utf8").digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signatureHeader, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

/**
 * Vérifie secret en clair (format DocuSeal v2.x actuel).
 * Header : `X-Docuseal-Secret: <secret_brut>`.
 */
export function verifyWebhookSecret(secretHeader: string | null): boolean {
  if (!secretHeader) return false;
  const expected = getWebhookSecret();
  if (secretHeader.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(secretHeader, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}

/**
 * Auth wrapper : tente d'abord HMAC (legacy), puis secret en clair
 * (DocuSeal v2). Renvoie true si au moins un des 2 schémas matche.
 */
export function verifyWebhookAuth(
  rawBody: string,
  headers: { signature: string | null; secret: string | null },
): boolean {
  if (headers.signature && verifyWebhookSignature(rawBody, headers.signature)) return true;
  if (headers.secret && verifyWebhookSecret(headers.secret)) return true;
  return false;
}
