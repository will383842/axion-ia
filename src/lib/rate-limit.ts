// Sliding window rate limiter via Redis sorted sets (Sprint 15 / M8).
//
// Pattern : pour chaque (key, fenetre), on stocke des timestamps en sorted set,
// on purge les vieux, puis on compte ceux dans la fenetre courante. Atomique
// via pipeline. Fail-open si Redis down (preserve l'UX, alerte Sentry).
//
// Usage type :
//   const ok = await checkRateLimit(`auth:login:${ip}`, { limit: 5, windowSec: 900 });
//   if (!ok.allowed) throw new Error("too many attempts");

import { redis } from "./redis";

export interface RateLimitConfig {
  /** Nombre max de hits autorises dans la fenetre. */
  limit: number;
  /** Duree de la fenetre en secondes. */
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Hits comptabilises dans la fenetre actuelle (ce hit inclus si allowed). */
  count: number;
  /** Hits restants avant blocage. */
  remaining: number;
  /** Timestamp ms du prochain reset (= timestamp du plus vieux hit + windowSec). */
  resetAt: number;
}

export async function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = config.windowSec * 1000;
  const cutoff = now - windowMs;
  const member = `${now}:${Math.random().toString(36).slice(2, 8)}`;

  try {
    const pipe = redis.pipeline();
    pipe.zremrangebyscore(key, 0, cutoff);
    pipe.zadd(key, now, member);
    pipe.zcard(key);
    pipe.pexpire(key, windowMs);
    const results = await pipe.exec();

    if (!results) {
      return failOpen(now, config.limit, windowMs);
    }
    const countResult = results[2];
    const count = (countResult?.[1] as number | undefined) ?? 0;
    const allowed = count <= config.limit;
    if (!allowed) {
      // Suppression du marker du hit refuse (sinon il bloque le reset)
      await redis.zrem(key, member);
    }
    return {
      allowed,
      count: allowed ? count : count - 1,
      remaining: Math.max(0, config.limit - count),
      resetAt: now + windowMs,
    };
  } catch {
    // Fail-open : Redis indisponible → on laisse passer, mais on log.
    // (En prod on alerte Sentry — branche en M11.)
    return failOpen(now, config.limit, windowMs);
  }
}

function failOpen(now: number, limit: number, windowMs: number): RateLimitResult {
  return {
    allowed: true,
    count: 0,
    remaining: limit,
    resetAt: now + windowMs,
  };
}
