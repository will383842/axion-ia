// Bannissement temporaire (T-29, REQ-062) — au-dessus du rate-limit.
//
// Le rate-limit (sliding window) bride le débit ; le bannissement coupe une
// source qui DÉPASSE le rate-limit de façon RÉPÉTÉE (bot insistant). Après N
// violations dans une fenêtre, on pose un ban Redis à TTL → les requêtes
// suivantes sont rejetées tôt (avant tout traitement).
//
// Fail-open : si Redis est indisponible, on ne bannit jamais (préserve l'UX) —
// le rate-limit reste le filet. Tout est best-effort (jamais d'exception remontée).

import { redis } from "@/lib/redis";

const BAN_PREFIX = "chatbot:ban:";
const VIOL_PREFIX = "chatbot:viol:";

/** Violations (dépassements de rate-limit) tolérées avant ban. */
export const BAN_VIOLATION_THRESHOLD = 10;
/** Fenêtre de comptage des violations (s). */
export const BAN_VIOLATION_WINDOW_SEC = 600;
/** Durée du bannissement (s). */
export const BAN_TTL_SEC = 3600;

/** true si la clé (IP/session) est actuellement bannie. */
export async function isBanned(key: string): Promise<boolean> {
  try {
    return (await redis.exists(`${BAN_PREFIX}${key}`)) === 1;
  } catch {
    return false; // fail-open
  }
}

/**
 * Enregistre une violation (dépassement de rate-limit). Au-delà du seuil dans la
 * fenêtre, pose un ban et retourne true (« vient d'être banni »).
 */
export async function recordViolation(key: string): Promise<boolean> {
  try {
    const vkey = `${VIOL_PREFIX}${key}`;
    const count = await redis.incr(vkey);
    if (count === 1) await redis.expire(vkey, BAN_VIOLATION_WINDOW_SEC);
    if (count >= BAN_VIOLATION_THRESHOLD) {
      await redis.set(`${BAN_PREFIX}${key}`, "1", "EX", BAN_TTL_SEC);
      await redis.del(vkey);
      return true;
    }
    return false;
  } catch {
    return false; // fail-open
  }
}
