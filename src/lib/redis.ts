// Redis client singleton (Sprint 15 / M8)
//
// Usage : rate-limit, BullMQ queue, cache.
// Lazy init : on ne se connecte que quand un consommateur l'importe,
// jamais au cold-start de Next.js (Edge runtime ne tolere pas ioredis).

import Redis, { type RedisOptions } from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6381";

const baseOptions: RedisOptions = {
  // Reconnect strategy : exponential backoff capped a 5s
  retryStrategy(times) {
    return Math.min(times * 200, 5000);
  },
  // Pas de retry infini sur ECONNREFUSED en dev (DB down) — fail fast
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
};

function createRedis(): Redis {
  const client = new Redis(REDIS_URL, baseOptions);
  // Avoid Node crash from unhandled "error" event when Redis is unreachable
  // at boot. Connection retries continue per retryStrategy; consumers that
  // need Redis will see commands fail individually via maxRetriesPerRequest.
  client.on("error", (err: Error) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[redis]", err.message);
    }
  });
  return client;
}

export const redis = globalForRedis.redis ?? createRedis();

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

/** Test connectivity. Retourne true si Redis repond a un PING en < 500ms. */
export async function pingRedis(): Promise<boolean> {
  try {
    const r = await Promise.race([
      redis.ping(),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error("timeout")), 500)),
    ]);
    return r === "PONG";
  } catch {
    return false;
  }
}
