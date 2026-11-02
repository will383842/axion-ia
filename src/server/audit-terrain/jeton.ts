/**
 * Jeton d'audit présentiel (PR2). Format : `axa_<sessionId>_<secret>`.
 *
 *  - `sessionId` : UUID de la ligne `audit_terrain_sessions` (donc liée à UN client, UN audit) ;
 *  - `secret` : 32 octets aléatoires en base64url (43 caractères), affiché UNE seule fois.
 *
 * En base : `jetonEmpreinte` = SHA-256 (hex) du SECRET seul. Le jeton n'est jamais stocké.
 * La recherche se fait par empreinte (index unique) ; la comparaison finale est à temps constant.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const PREFIXE_JETON = "axa_";
const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const FORME = new RegExp(`^${PREFIXE_JETON}(${UUID})_([A-Za-z0-9_-]{43})$`);

/** Durée de vie par défaut : J+2 (décision de l'audit sécurité). */
export const JETON_DUREE_DEFAUT_JOURS = 2;
export const JETON_DUREE_MAX_JOURS = 10;

export function empreinteJeton(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function genererSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function composerJeton(sessionId: string, secret: string): string {
  return `${PREFIXE_JETON}${sessionId}_${secret}`;
}

export interface JetonLu {
  readonly sessionId: string;
  readonly secret: string;
  readonly empreinte: string;
}

/** `null` si la forme est mauvaise. Ne renseigne jamais sur la raison. */
export function lireJeton(entete: string | null): JetonLu | null {
  if (!entete) return null;
  const m = /^Bearer ([^\s]+)$/.exec(entete.trim());
  if (!m) return null;
  const j = FORME.exec(m[1]!);
  if (!j) return null;
  return { sessionId: j[1]!.toLowerCase(), secret: j[2]!, empreinte: empreinteJeton(j[2]!) };
}

/** Comparaison à temps constant de deux empreintes hexadécimales. */
export function memeEmpreinte(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}
