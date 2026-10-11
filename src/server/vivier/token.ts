/**
 * JETON D'OPPOSITION VIVIER — un clic, sans login (lot L4, plan §2.3).
 *
 * Même mécanique que le jeton du self-service RGPD (`src/lib/gdpr-token.ts`) :
 * HMAC-SHA256 Web Crypto, format compact `base64url(payload).base64url(sig)`,
 * secret `AUTH_SECRET`. Le motif est éprouvé, on ne le réinvente pas.
 *
 * ── Deux différences DÉLIBÉRÉES avec le jeton RGPD ──────────────────────────
 *
 * 1. Un champ `aud` ("vivier-opposition") est signé DANS le payload et vérifié
 *    au retour. Sans lui, les deux jetons partageant le même secret, un jeton
 *    d'export RGPD intercepté vaudrait opposition vivier — et réciproquement.
 *    Ce sont deux autorisations distinctes : elles ne doivent pas être
 *    interchangeables.
 *
 * 2. La durée de vie est LONGUE (400 jours) là où le jeton RGPD vit 24 h. Ce
 *    n'est pas un relâchement : le lien vit dans un email que la personne peut
 *    rouvrir des mois plus tard, et l'email lui promet de pouvoir se rétracter
 *    « à tout moment ». Un lien expiré au bout de 24 h transformerait cette
 *    promesse en mensonge, et l'opposition — un DROIT — en course contre la
 *    montre. Le pouvoir conféré est d'ailleurs minuscule et non destructeur :
 *    faire retirer SA PROPRE candidature d'un vivier. 400 jours couvrent la
 *    fenêtre de 30 jours et l'essentiel de la conservation de 2 ans.
 *
 * ── Une seconde finalité : l'EFFACEMENT par le candidat (2026-10-11) ────────
 *
 * Le lien « Supprimer ma candidature » des e-mails aux candidats signe le même
 * genre de jeton (une candidature, une échéance), avec SA PROPRE audience
 * (`candidature-effacement`). Mêmes octets, même secret, même vérification :
 * c'est l'audience seule qui sépare les deux autorisations. Un jeton
 * d'opposition ne peut donc pas effacer un dossier, et réciproquement.
 *
 * Sa durée de vie couvre la conservation entière du dossier (24 mois après le
 * dernier échange) : un lien qui expirerait avant le dossier ferait de
 * l'effacement en un clic une promesse à durée limitée.
 */

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

const JOUR_MS = 24 * 60 * 60 * 1000;

/** Cf. en-tête : le lien doit survivre dans la boîte mail du candidat. */
const TOKEN_TTL_MS = 400 * JOUR_MS;

/** Séparateur de domaine : rend le jeton inutilisable pour une autre action. */
const AUDIENCE = "vivier-opposition";

/** Lien « Supprimer ma candidature » — autre autorisation, autre audience. */
const AUDIENCE_EFFACEMENT = "candidature-effacement";

/** 26 mois : la conservation (24 mois après le dernier échange) et sa marge. */
const TOKEN_EFFACEMENT_TTL_MS = 800 * JOUR_MS;

interface TokenPayload {
  /** Identifiant de la candidature visée. */
  sub: string;
  aud: string;
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
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET required for vivier opposition token signing");
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

/** Signe un jeton pour UNE candidature précise et UNE finalité. */
async function signer(applicationId: string, aud: string, ttlMs: number): Promise<string> {
  const payload: TokenPayload = {
    sub: applicationId,
    aud,
    exp: Date.now() + ttlMs,
  };
  const payloadBytes = ENCODER.encode(JSON.stringify(payload));
  const payloadB64 = b64urlEncode(payloadBytes);
  const key = await hmacKey();
  const sigBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, payloadBytes as BufferSource),
  );
  return `${payloadB64}.${b64urlEncode(sigBytes)}`;
}

/** Signe un lien d'opposition pour UNE candidature précise. */
export async function signVivierOppositionToken(applicationId: string): Promise<string> {
  return signer(applicationId, AUDIENCE, TOKEN_TTL_MS);
}

/** Signe un lien d'EFFACEMENT pour UNE candidature précise. */
export async function signEffacementCandidatureToken(applicationId: string): Promise<string> {
  return signer(applicationId, AUDIENCE_EFFACEMENT, TOKEN_EFFACEMENT_TTL_MS);
}

export type VivierTokenResult = { ok: true; applicationId: string } | { ok: false; reason: string };

/**
 * Vérifie un jeton d'opposition.
 *
 * 🔴 L'ordre des contrôles n'est pas décoratif : la SIGNATURE est vérifiée
 * AVANT que le payload ne soit désérialisé et lu. Lire d'abord reviendrait à
 * faire confiance à des octets non authentifiés.
 */
export async function verifyVivierOppositionToken(
  token: string | null | undefined,
): Promise<VivierTokenResult> {
  return verifier(token, AUDIENCE);
}

/** Vérifie un jeton d'effacement — refuse tout jeton d'une autre finalité. */
export async function verifyEffacementCandidatureToken(
  token: string | null | undefined,
): Promise<VivierTokenResult> {
  return verifier(token, AUDIENCE_EFFACEMENT);
}

async function verifier(token: string | null | undefined, aud: string): Promise<VivierTokenResult> {
  if (!token) return { ok: false, reason: "missing_token" };

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

  let valid: boolean;
  try {
    const key = await hmacKey();
    valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes as BufferSource,
      payloadBytes as BufferSource,
    );
  } catch {
    return { ok: false, reason: "malformed_token" };
  }
  if (!valid) return { ok: false, reason: "invalid_signature" };

  let payload: TokenPayload;
  try {
    payload = JSON.parse(DECODER.decode(payloadBytes)) as TokenPayload;
  } catch {
    return { ok: false, reason: "malformed_payload" };
  }

  // Un jeton d'une AUTRE finalité (export RGPD, opposition, effacement…) est
  // refusé, bien que parfaitement signé : même secret, autorisations distinctes.
  if (payload.aud !== aud) return { ok: false, reason: "wrong_audience" };
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    return { ok: false, reason: "invalid_subject" };
  }
  if (typeof payload.exp !== "number" || payload.exp < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, applicationId: payload.sub };
}
