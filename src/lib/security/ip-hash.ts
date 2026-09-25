/**
 * IP hashing helper RGPD (Sprint Correctif S+1 / P0-S1-3 2026-05-16).
 *
 * SHA-256(salt::ip) tronqué à 16 hex (64 bits) — assez d'entropie pour anti-
 * réutilisation/déduplication, pas assez pour brute-force inverse pratique.
 *
 * Le salt est `process.env.IP_HASH_SALT` (≥ 32 chars, set via Coolify env var
 * Sprint S0 — cf. memory `axionia_session_2026-05-15_e2e_audit_fixes.md`).
 *
 * Doctrine : RGPD art. 4-1 — l'IP est une donnée personnelle. Stocker en clair
 * permet le tracking via croisement avec des logs externes. Hasher avec salt
 * organisationnel rompt ce lien tout en préservant l'anti-fraude (dedup +
 * burst-detection sur la même session).
 */

import { createHash } from "node:crypto";

const DEFAULT_DEV_SALT = "axion-ia-dev-only-do-not-use-in-prod";

/**
 * Retourne le hash SHA-256 tronqué de l'IP.
 *
 * @param ip — IP brute (IPv4 ou IPv6). Si `null`/`undefined`/empty, retourne `null`.
 * @returns 16 caractères hex, ou `null` si IP absente.
 */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const salt = process.env.IP_HASH_SALT ?? DEFAULT_DEV_SALT;
  if (salt === DEFAULT_DEV_SALT && process.env.NODE_ENV === "production") {
    // Fail-loud en prod : pas de fallback silencieux sur le salt dev.
    throw new Error("IP_HASH_SALT manquant en production (RGPD doctrine).");
  }
  return createHash("sha256").update(`${salt}::${ip}`).digest("hex").slice(0, 16);
}

/**
 * Préfixe des agents navigateur HACHÉS (lot L6, relecture du 2026-09-25).
 *
 * `consent_events.user_agent` a été écrit EN CLAIR jusqu'à ce lot. La purge
 * quotidienne rattrape les valeurs anciennes ; le préfixe est ce qui lui dit
 * qu'une valeur est déjà traitée — sans lui, elle hacherait l'empreinte.
 */
export const PREFIXE_AGENT_HACHE = "h:" as const;

/** Vrai si la valeur est déjà une empreinte d'agent (`h:` + 16 hex). */
export function estAgentHache(valeur: string): boolean {
  return /^h:[0-9a-f]{16}$/.test(valeur);
}

/**
 * Empreinte de l'agent navigateur : MÊME mécanisme et MÊME sel que l'IP
 * (`hashIp`), préfixée `h:`. Une valeur déjà hachée est rendue telle quelle
 * (idempotent). `null` si l'agent est absent ; lève en production si le sel
 * manque, comme `hashIp`.
 */
export function hashUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null;
  if (estAgentHache(ua)) return ua;
  const h = hashIp(ua);
  return h === null ? null : `${PREFIXE_AGENT_HACHE}${h}`;
}
