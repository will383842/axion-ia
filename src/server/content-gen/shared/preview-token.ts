/**
 * Content Generator — Preview token signing (Fix P1-13 audit opérationnel
 * 2026-05-14).
 *
 * HMAC-SHA256 token léger pour signer des URLs preview iframe sans dépendance
 * JWT externe. Token = base64url(payload).hmac(secret, payload). Expire après
 * `expiresInSec` (défaut 10 min). Le secret `PREVIEW_TOKEN_SECRET` doit faire
 * ≥ 32 chars en prod.
 *
 * Pattern identique au knowledge HMAC `src/lib/knowledge/hmac.ts`.
 */

import crypto from "node:crypto";

const DEFAULT_EXPIRES_SEC = 10 * 60;

interface PreviewTokenPayload {
  readonly jobId: string;
  readonly exp: number; // unix epoch sec
}

function getSecret(): string {
  const s = process.env.PREVIEW_TOKEN_SECRET;
  if (s && s.length >= 16) return s;

  // Sprint S6.3 P3-14 (2026-05-15) — hard-fail prod : si ni
  // PREVIEW_TOKEN_SECRET ni AUTH_SECRET ne sont définis (≥ 16 chars) en
  // NODE_ENV=production, on refuse de signer plutôt que de tomber sur le
  // fallback dev. Évite qu'un déploiement avec env vars incomplètes émette
  // des tokens prédictibles signés avec le secret dev hardcodé.
  const fallbackAuth = process.env.AUTH_SECRET;
  if (fallbackAuth && fallbackAuth.length >= 16) return fallbackAuth;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "PREVIEW_TOKEN_SECRET (or AUTH_SECRET fallback) must be ≥ 16 chars in production — refuse to sign with dev fallback.",
    );
  }
  // Fail-soft dev only.
  return "axionia-content-gen-preview-dev-fallback-32chars";
}

function base64UrlEncode(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function base64UrlDecode(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

/**
 * Crée un token preview signé pour `jobId` valable `expiresInSec` (10 min par
 * défaut). Format : `<base64url(JSON payload)>.<hex hmac>`.
 */
export function createPreviewToken(
  jobId: string,
  expiresInSec: number = DEFAULT_EXPIRES_SEC,
): string {
  const payload: PreviewTokenPayload = {
    jobId,
    exp: Math.floor(Date.now() / 1000) + expiresInSec,
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  const hmac = crypto.createHmac("sha256", getSecret()).update(body).digest("hex");
  return `${body}.${hmac}`;
}

/**
 * Vérifie + décode un token preview. Retourne `payload` si valide+non-expiré,
 * sinon `null`. Constant-time HMAC compare.
 */
export function verifyPreviewToken(token: string): PreviewTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", getSecret()).update(body).digest("hex");
  // timingSafeEqual exige même longueur
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) {
    return null;
  }
  try {
    const payload = JSON.parse(base64UrlDecode(body).toString("utf8")) as PreviewTokenPayload;
    if (typeof payload.jobId !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
