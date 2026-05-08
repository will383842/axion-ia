// Argon2id helpers SSOT (Sprint 15 fix Fork 3 N8-3 + W8-3).
//
// Avant : params Argon2 dispersés (auth.ts:55, seed.ts:31, admin-auth/actions.ts:55,190).
// Risque drift si nouveau use case. Ce module centralise + ajoute timing-safe.
//
// Params OWASP 2024 :
//   - argon2id (mémoire-hard ET résistant aux attaques side-channel)
//   - memoryCost 19456 (= 19 MiB ; recommandé OWASP minimum 19 MiB)
//   - timeCost 2 itérations
//   - parallelism 1 (single-thread; multi-thread seulement si CPU saturation prouvée)

import * as argon2 from "argon2";

const ARGON2_OPTS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * Hash un password en clair → argon2id digest.
 * Throw si le password est < 8 chars (defense en profondeur, normalement
 * Zod attrape avant).
 */
export async function hashPassword(plain: string): Promise<string> {
  if (typeof plain !== "string" || plain.length < 8) {
    throw new Error("password must be at least 8 chars");
  }
  return argon2.hash(plain, ARGON2_OPTS);
}

/**
 * Hash sentinel constant utilise pour timing-safe verify quand un user
 * n'existe pas (Sprint 15 fix Fork 3 W8-3 — evite oracle email valide vs
 * invalide via timing differential).
 *
 * Genere une fois au boot, jamais re-hashe. Le pwd "axion-ia-dummy" n'est
 * jamais valide pour aucun user reel (collision impossible vu argon2 random
 * salt).
 */
let _dummyHashCache: string | null = null;
async function getDummyHash(): Promise<string> {
  if (_dummyHashCache) return _dummyHashCache;
  _dummyHashCache = await argon2.hash("axion-ia-dummy", ARGON2_OPTS);
  return _dummyHashCache;
}

/**
 * Verify password constant-time avec defense oracle email.
 * Si `passwordHash` est null/undefined (user inexistant), on verifie quand
 * meme contre un dummy hash pour egaliser le timing.
 *
 * @returns true si match, false sinon (jamais throw).
 */
export async function verifyPasswordSafe(
  passwordHash: string | null | undefined,
  plain: string,
): Promise<boolean> {
  const hashToVerify = passwordHash ?? (await getDummyHash());
  try {
    const match = await argon2.verify(hashToVerify, plain);
    return passwordHash != null && match;
  } catch {
    return false;
  }
}
