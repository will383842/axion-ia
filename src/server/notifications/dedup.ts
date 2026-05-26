// Hub notifications — déduplication Redis (Sprint Notif Infra 2026-05-26).
//
// Pattern : SET NX EX. Si la clé existe déjà → l'event est un doublon, on skip.
// Sinon on pose la clé avec TTL et on laisse passer.
// Fail-open si Redis indisponible (préserve la fonction notif > la dédup).

import { redis } from "@/lib/redis";

const PREFIX = "notif:dedup:";

/**
 * Retourne true si l'event est un doublon (déjà vu dans le TTL).
 * Fail-open : si Redis throw, retourne false (on laisse passer).
 */
export async function isDuplicate(
  category: string,
  dedupKey: string,
  ttlSec = 300,
): Promise<boolean> {
  if (process.env.REDIS_URL?.includes("stub.invalid")) return false;
  const key = `${PREFIX}${category}:${dedupKey}`;
  try {
    const result = await redis.set(key, "1", "EX", ttlSec, "NX");
    // SET NX retourne "OK" si la clé a été posée (= pas un doublon),
    // null si la clé existait déjà (= doublon).
    return result === null;
  } catch {
    return false;
  }
}
