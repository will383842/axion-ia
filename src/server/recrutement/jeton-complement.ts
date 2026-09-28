/**
 * JETON « COMPLÉTER MA CANDIDATURE » — un lien personnel, sans login.
 *
 * Demande Will 2026-09-28 : 29 monteurs vidéo sur 31 ont postulé avant que
 * l'offre ne demande des prix exacts. Leur écrire « répondez à ce message »
 * obligeait à recopier trente e-mails à la main dans trente fiches. Le lien
 * ouvre une page qui pose les questions de l'offre et écrit les réponses
 * DIRECTEMENT dans la fiche du candidat.
 *
 * Même mécanique que le jeton d'opposition vivier (`server/vivier/token.ts`) :
 * HMAC-SHA256 Web Crypto, `base64url(payload).base64url(sig)`, `AUTH_SECRET`.
 *
 * ── Ce que le jeton signe, et pourquoi ─────────────────────────────────────
 *  · `sub` : la candidature. Le lien n'écrit que dans CELLE-LÀ.
 *  · `off` : l'offre dont on pose les questions, figée à l'envoi. Si l'offre
 *    change de questions entre l'envoi et le clic, la page lit les questions
 *    actuelles de CETTE offre — jamais celles d'une autre.
 *  · `aud` : séparation de domaine. Un jeton vivier ou RGPD, signé avec le
 *    même secret, est refusé ici — et réciproquement.
 *  · `exp` : 60 jours. Le pouvoir conféré est petit (compléter SA propre
 *    candidature, jamais la lire au-delà de ses propres réponses), mais il
 *    permet d'écrire : il ne vit pas 400 jours comme l'opposition.
 */

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

const TOKEN_TTL_MS = 60 * 24 * 60 * 60 * 1000;
const AUDIENCE = "candidature-complement";

interface TokenPayload {
  sub: string;
  off: string;
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

async function hmacKey(): Promise<CryptoKey> {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET required for candidature complement token signing");
  return crypto.subtle.importKey(
    "raw",
    ENCODER.encode(s) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Signe le lien de complément d'UNE candidature, pour les questions d'UNE offre. */
export async function signerJetonComplement(
  applicationId: string,
  offerId: string,
  maintenant: number = Date.now(),
): Promise<string> {
  const payload: TokenPayload = {
    sub: applicationId,
    off: offerId,
    aud: AUDIENCE,
    exp: maintenant + TOKEN_TTL_MS,
  };
  const payloadBytes = ENCODER.encode(JSON.stringify(payload));
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", await hmacKey(), payloadBytes as BufferSource),
  );
  return `${b64urlEncode(payloadBytes)}.${b64urlEncode(sig)}`;
}

export type JetonComplement =
  | { ok: true; applicationId: string; offerId: string }
  | { ok: false; reason: string };

/**
 * Vérifie un jeton. 🔴 La SIGNATURE est vérifiée avant que le payload ne soit
 * lu : lire d'abord, c'est faire confiance à des octets non authentifiés.
 */
export async function verifierJetonComplement(
  token: string | null | undefined,
  maintenant: number = Date.now(),
): Promise<JetonComplement> {
  if (!token) return { ok: false, reason: "missing_token" };
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed_token" };
  const [payloadB64, sigB64] = parts as [string, string];

  let payloadBytes: Uint8Array;
  let valid: boolean;
  try {
    payloadBytes = b64urlDecode(payloadB64);
    valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      b64urlDecode(sigB64) as BufferSource,
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
  if (payload.aud !== AUDIENCE) return { ok: false, reason: "wrong_audience" };
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    return { ok: false, reason: "invalid_subject" };
  }
  if (typeof payload.off !== "string" || payload.off.length === 0) {
    return { ok: false, reason: "invalid_offer" };
  }
  if (typeof payload.exp !== "number" || payload.exp < maintenant) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, applicationId: payload.sub, offerId: payload.off };
}
