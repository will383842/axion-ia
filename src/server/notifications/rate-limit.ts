// Hub notifications — rate-limit par catégorie (Sprint Notif Infra 2026-05-26).
//
// Fixed-window counter Redis (INCR + EXPIRE NX). Plus simple que sliding window,
// suffisant ici (objectif : éviter spam Telegram en cas de flood, pas anti-DDoS).
// Fail-open si Redis indisponible.

import { redis } from "@/lib/redis";

const PREFIX = "notif:rl:";

/**
 * Retourne true si l'event est autorisé (sous le quota), false sinon.
 * Fail-open : si Redis throw, retourne true.
 *
 * @param category - clé de groupement (ex : "SECURITY_ALERT")
 * @param maxPerHour - quota max par heure
 */
export async function checkCategoryRateLimit(
  category: string,
  maxPerHour: number,
): Promise<boolean> {
  if (maxPerHour <= 0) return true;
  if (process.env.REDIS_URL?.includes("stub.invalid")) return true;
  const bucket = Math.floor(Date.now() / 3_600_000); // heure UTC
  const key = `${PREFIX}${category}:${bucket}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      // Première écriture de la fenêtre — pose le TTL (1h + 10s marge).
      await redis.expire(key, 3610);
    }
    return count <= maxPerHour;
  } catch {
    return true;
  }
}
