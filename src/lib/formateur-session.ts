// Session passwordless de l'espace formateur (2026-06-13).
//
// Jeton de session autonome, signé HMAC-SHA256 (Web Crypto → Edge-safe), pour
// que le middleware (proxy.ts, Edge runtime) puisse vérifier l'accès sans appel
// DB. La révocation (Trainer.actif=false) est appliquée au niveau Node par
// `requireFormateur()` (relookup Prisma à chaque requête protégée).
//
// ⚠️ Distinct du magic-token (src/lib/magic-token.ts) :
//   - magic-token = lien de CONNEXION court (15 min, usage unique) reçu par e-mail.
//   - formateur-session = jeton de SESSION long (cookie HttpOnly) posé APRÈS
//     consommation du lien. Payload minimal { sub: trainerId, exp }.
//
// Format compact : `<payload-b64url>.<sig-b64url>` — même schéma que magic-token.
// Secret = AUTH_SECRET (commune à l'app).
//
// Le module est générique (espace formateur ET espace ressources) : un claim
// d'AUDIENCE (`aud`) lie le jeton à son espace, pour qu'un cookie d'un espace
// ne puisse pas être présenté à l'autre (défense en profondeur, en plus de la
// disjonction des espaces d'identifiants).

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

/** Durée de vie d'une session : 30 jours (réaligné sur l'admin). */
export const FORMATEUR_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Audiences possibles d'une session passwordless. */
export type SessionAudience = "formateur" | "ressources";

interface SessionPayload {
  /** Identifiant du sujet (trainerId pour formateur, recipientId pour ressources). */
  sub: string;
  /** Audience : espace auquel ce jeton donne accès. */
  aud: SessionAudience;
  /** Expiration (unix ms). */
  exp: number;
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
  if (!s) throw new Error("AUTH_SECRET required for formateur session signing");
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

/**
 * Signe un jeton de session pour `subjectId`, lié à une `audience`.
 * TTL par défaut = {@link FORMATEUR_SESSION_MAX_AGE_SECONDS}.
 */
export async function signFormateurSession(
  subjectId: string,
  audience: SessionAudience,
  ttlSeconds: number = FORMATEUR_SESSION_MAX_AGE_SECONDS,
): Promise<string> {
  const payload: SessionPayload = {
    sub: subjectId,
    aud: audience,
    exp: Date.now() + ttlSeconds * 1000,
  };
  const payloadBytes = ENCODER.encode(JSON.stringify(payload));
  const payloadB64 = b64urlEncode(payloadBytes);
  const key = await hmacKey();
  const sigBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, payloadBytes as BufferSource),
  );
  return `${payloadB64}.${b64urlEncode(sigBytes)}`;
}

export type FormateurSessionResult =
  | { ok: true; trainerId: string }
  | { ok: false; reason: "malformed" | "invalid_signature" | "expired" | "wrong_audience" };

/**
 * Vérifie un jeton de session (signature + expiration + audience).
 * Edge-safe (Web Crypto uniquement) — utilisable dans proxy.ts.
 * NE vérifie PAS `actif` (relookup DB → côté Node `requireFormateur/requireRecipient`).
 * `trainerId` dans le résultat = le sujet (trainerId OU recipientId selon l'audience).
 */
export async function verifyFormateurSession(
  token: string,
  expectedAudience: SessionAudience,
): Promise<FormateurSessionResult> {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [payloadB64, sigB64] = parts as [string, string];

  let payloadBytes: Uint8Array;
  let sigBytes: Uint8Array;
  try {
    payloadBytes = b64urlDecode(payloadB64);
    sigBytes = b64urlDecode(sigB64);
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const key = await hmacKey();
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes as BufferSource,
    payloadBytes as BufferSource,
  );
  if (!valid) return { ok: false, reason: "invalid_signature" };

  let payload: SessionPayload;
  try {
    payload = JSON.parse(DECODER.decode(payloadBytes)) as SessionPayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (typeof payload.sub !== "string" || !payload.sub) {
    return { ok: false, reason: "malformed" };
  }
  if (payload.aud !== expectedAudience) {
    return { ok: false, reason: "wrong_audience" };
  }
  if (typeof payload.exp !== "number" || payload.exp < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, trainerId: payload.sub };
}
