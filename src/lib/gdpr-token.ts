// GDPR self-service token (Sprint 24 / D2).
//
// HMAC-SHA256 signed compact token { email, exp, jti }. Permet à un
// utilisateur d'authentifier une demande d'export RGPD via un lien envoyé
// par email (sans login admin), sans réinventer JOSE.
//
// Format compact : base64url(payload).base64url(sig).
// Payload JSON : { email, exp (unix ms), jti }.
//
// Web Crypto API (Edge-safe) — pas de dépendance externe.

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

interface TokenPayload {
  email: string;
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
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET required for GDPR token signing");
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

/** Generate a 12-byte random hex (jti — token unique id, can be revoked). */
function randomJti(): string {
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signGdprToken(email: string): Promise<string> {
  const payload: TokenPayload = {
    email: email.toLowerCase().trim(),
    exp: Date.now() + TOKEN_TTL_MS,
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

export async function verifyGdprToken(
  token: string,
): Promise<{ ok: true; email: string; jti: string } | { ok: false; reason: string }> {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed_token" };
  const [payloadB64, sigB64] = parts as [string, string];

  let payloadBytes: Uint8Array;
  try {
    payloadBytes = b64urlDecode(payloadB64);
  } catch {
    return { ok: false, reason: "malformed_token" };
  }
  const sigBytes = b64urlDecode(sigB64);
  const key = await hmacKey();
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes as BufferSource,
    payloadBytes as BufferSource,
  );
  if (!valid) return { ok: false, reason: "invalid_signature" };

  let payload: TokenPayload;
  try {
    payload = JSON.parse(DECODER.decode(payloadBytes)) as TokenPayload;
  } catch {
    return { ok: false, reason: "malformed_payload" };
  }
  if (typeof payload.email !== "string" || !payload.email.includes("@")) {
    return { ok: false, reason: "invalid_email" };
  }
  if (typeof payload.exp !== "number" || payload.exp < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, email: payload.email, jti: payload.jti };
}
