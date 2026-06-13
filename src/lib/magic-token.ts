// Magic-token générique (Sprint X.15 / Booking V1).
//
// Tokens HMAC-SHA256 signés, scopés à une action + ressource + email + TTL.
// Factorise le pattern `gdpr-token.ts` (Sprint 24) avec un payload générique.
//
// Format compact : `<payload-b64url>.<sig-b64url>`
// Payload JSON : { scope, resourceId, email?, exp (unix ms), jti }
//
// Scopes V1 supportés :
//   - 'cancel'           — TTL 24 h  — annulation self-service par client (Sprint X.15)
//   - 'reschedule'       — TTL 24 h  — reschedule client (Sprint X.15)
//   - 'portal'           — TTL 30 min — redirect Stripe Customer Portal (V2+)
//   - 'formateur_login'  — TTL 15 min — connexion passwordless espace formateur (2026-06-13).
//                          Usage unique imposé par la table FormateurMagicLink (tokenHash +
//                          usedAt) : le jti est tracé en base, un lien déjà consommé est rejeté.
//
// Sécurité :
//   - secret = AUTH_SECRET (commune à l'app, env Coolify).
//   - HMAC-SHA256 via Web Crypto (Edge-safe).
//   - jti unique pour permettre revocation explicite si besoin (V1.5+).
//   - Compare-constant via crypto.subtle.verify (timing-safe par construction).
//
// Replay attack : token réutilisable jusqu'à expiration. V1.5 ajoutera un
// store de jti consommés (Redis SETEX) pour usage one-shot.

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

export type MagicScope =
  | "cancel"
  | "reschedule"
  | "portal"
  | "formateur_login"
  | "ressources_login";

/** TTL par scope, en millisecondes. */
const TTL_MS: Record<MagicScope, number> = {
  cancel: 24 * 60 * 60 * 1000, // 24 h
  reschedule: 24 * 60 * 60 * 1000, // 24 h
  portal: 30 * 60 * 1000, // 30 min
  formateur_login: 15 * 60 * 1000, // 15 min (lien de connexion court, sécurité)
  ressources_login: 15 * 60 * 1000, // 15 min — connexion espace ressources (commercial/formateur)
};

interface MagicPayload {
  scope: MagicScope;
  resourceId: string;
  /** Optionnel — utile pour double-check vs Booking.submission.contactEmail. */
  email?: string;
  exp: number;
  jti: string;
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const padded = s
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(s.length + ((4 - (s.length % 4)) % 4), "=");
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function getSecret(): Uint8Array {
  const s = process.env["AUTH_SECRET"];
  if (!s) throw new Error("AUTH_SECRET required for magic-token signing");
  return ENCODER.encode(s);
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    getSecret() as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function randomJti(): string {
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface SignMagicTokenInput {
  scope: MagicScope;
  resourceId: string;
  email?: string;
  /** Override TTL (ms). Par défaut : `TTL_MS[scope]`. */
  ttlMs?: number;
}

export async function signMagicToken(input: SignMagicTokenInput): Promise<string> {
  const payload: MagicPayload = {
    scope: input.scope,
    resourceId: input.resourceId,
    ...(input.email ? { email: input.email.toLowerCase().trim() } : {}),
    exp: Date.now() + (input.ttlMs ?? TTL_MS[input.scope]),
    jti: randomJti(),
  };
  const payloadBytes = ENCODER.encode(JSON.stringify(payload));
  const payloadB64 = b64urlEncode(payloadBytes);
  const key = await hmacKey();
  const sigBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, payloadBytes as BufferSource),
  );
  const sigB64 = b64urlEncode(sigBytes);
  return `${payloadB64}.${sigB64}`;
}

export type VerifyResult =
  | { ok: true; scope: MagicScope; resourceId: string; email?: string; jti: string }
  | { ok: false; reason: VerifyFailReason };

export type VerifyFailReason =
  | "malformed_token"
  | "malformed_payload"
  | "invalid_signature"
  | "expired"
  | "scope_mismatch"
  | "resource_mismatch"
  | "invalid_email";

/**
 * Vérifie un magic token. Optionnellement valide aussi le scope et/ou
 * resourceId attendus (anti-mauvaise-réutilisation).
 */
export async function verifyMagicToken(
  token: string,
  expected?: { scope?: MagicScope; resourceId?: string },
): Promise<VerifyResult> {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed_token" };
  const [payloadB64, sigB64] = parts as [string, string];

  let payloadBytes: Uint8Array;
  let sigBytes: Uint8Array;
  try {
    payloadBytes = b64urlDecode(payloadB64);
    sigBytes = b64urlDecode(sigB64);
  } catch {
    return { ok: false, reason: "malformed_token" };
  }
  const key = await hmacKey();
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes as BufferSource,
    payloadBytes as BufferSource,
  );
  if (!valid) return { ok: false, reason: "invalid_signature" };

  let payload: MagicPayload;
  try {
    payload = JSON.parse(DECODER.decode(payloadBytes)) as MagicPayload;
  } catch {
    return { ok: false, reason: "malformed_payload" };
  }
  if (typeof payload.exp !== "number" || payload.exp < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  if (expected?.scope && payload.scope !== expected.scope) {
    return { ok: false, reason: "scope_mismatch" };
  }
  if (expected?.resourceId && payload.resourceId !== expected.resourceId) {
    return { ok: false, reason: "resource_mismatch" };
  }
  if (payload.email && !payload.email.includes("@")) {
    return { ok: false, reason: "invalid_email" };
  }
  return {
    ok: true,
    scope: payload.scope,
    resourceId: payload.resourceId,
    ...(payload.email ? { email: payload.email } : {}),
    jti: payload.jti,
  };
}
